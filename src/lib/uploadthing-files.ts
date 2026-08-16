/**
 * GDPR: remove Uploadthing blobs owned by a user before Neon cascade.
 * File keys are inferred from stored HTTPS URLs (no extra DB column).
 */

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  contentProjects,
  generations,
  referenceImages,
  userPreferences,
  users,
} from "@/lib/db/schema";

const UPLOADTHING_HOST_SUFFIXES = [
  "ufs.sh",
  "utfs.io",
  "uploadthing.com",
] as const;

const HTTPS_URL_RE = /https:\/\/[^\s"'<>\\)]+/gi;
const PAGE_SIZE = 200;
const MAX_PAGES_PER_TABLE = 50;
const DELETE_CHUNK_SIZE = 100;
const MAX_FILE_KEY_LENGTH = 512;

function isUploadthingHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return UPLOADTHING_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`)
  );
}

function isPlausibleFileKey(key: string): boolean {
  if (!key || key.length > MAX_FILE_KEY_LENGTH) return false;
  if (key.includes("/") || key.includes("\\") || key.includes("\0")) {
    return false;
  }
  if (key === "." || key === "..") return false;
  return true;
}

/** Extract a Uploadthing fileKey from a known UT URL, or null. */
export function extractUploadthingFileKey(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }

  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (!isUploadthingHost(url.hostname)) return null;

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;

  let encoded: string | undefined;
  if (segments[0] === "f") {
    encoded = segments[1];
  } else if (segments[0] === "a" && segments.length >= 3) {
    encoded = segments[segments.length - 1];
  } else {
    return null;
  }

  if (!encoded) return null;

  let key: string;
  try {
    key = decodeURIComponent(encoded);
  } catch {
    return null;
  }

  return isPlausibleFileKey(key) ? key : null;
}

export function extractUploadthingFileKeysFromText(text: string): string[] {
  const keys = new Set<string>();
  const matches = text.match(HTTPS_URL_RE) ?? [];
  for (const match of matches) {
    const cleaned = match.replace(/[.,;:]+$/, "");
    const key = extractUploadthingFileKey(cleaned);
    if (key) keys.add(key);
  }
  return [...keys];
}

export function collectUploadthingKeysFromSources(sources: {
  urls?: Array<string | null | undefined>;
  texts?: Array<string | null | undefined>;
}): string[] {
  const keys = new Set<string>();

  for (const url of sources.urls ?? []) {
    if (!url) continue;
    const key = extractUploadthingFileKey(url);
    if (key) keys.add(key);
    for (const nested of extractUploadthingFileKeysFromText(url)) {
      keys.add(nested);
    }
  }

  for (const text of sources.texts ?? []) {
    if (!text) continue;
    for (const key of extractUploadthingFileKeysFromText(text)) {
      keys.add(key);
    }
  }

  return [...keys];
}

function urlsFromProjectBlocks(blocks: unknown): string[] {
  if (!Array.isArray(blocks)) return [];
  const urls: string[] = [];
  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;
    const record = block as Record<string, unknown>;
    if (typeof record.url === "string") urls.push(record.url);
    if (typeof record.content === "string") urls.push(record.content);
  }
  return urls;
}

async function collectPaged<T>(
  fetchPage: (offset: number) => Promise<T[]>,
  visit: (rows: T[]) => void
): Promise<void> {
  for (let page = 0; page < MAX_PAGES_PER_TABLE; page++) {
    const rows = await fetchPage(page * PAGE_SIZE);
    if (rows.length === 0) return;
    visit(rows);
    if (rows.length < PAGE_SIZE) return;
  }
  console.error(
    `Stopped collecting Uploadthing keys after ${MAX_PAGES_PER_TABLE} pages`
  );
}

export async function collectUserUploadthingFileKeys(
  userId: string
): Promise<string[]> {
  const urls: string[] = [];
  const texts: string[] = [];

  const [profile] = await db
    .select({ avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (profile?.avatarUrl) urls.push(profile.avatarUrl);

  const [prefs] = await db
    .select({ customAvatarUrl: userPreferences.customAvatarUrl })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);
  if (prefs?.customAvatarUrl) urls.push(prefs.customAvatarUrl);

  await collectPaged(
    (offset) =>
      db
        .select({ url: referenceImages.url })
        .from(referenceImages)
        .where(eq(referenceImages.userId, userId))
        .limit(PAGE_SIZE)
        .offset(offset),
    (rows) => {
      for (const row of rows) urls.push(row.url);
    }
  );

  await collectPaged(
    (offset) =>
      db
        .select({
          outputContent: generations.outputContent,
          referenceImageUrl: generations.referenceImageUrl,
        })
        .from(generations)
        .where(eq(generations.userId, userId))
        .limit(PAGE_SIZE)
        .offset(offset),
    (rows) => {
      for (const row of rows) {
        texts.push(row.outputContent);
        if (row.referenceImageUrl) urls.push(row.referenceImageUrl);
      }
    }
  );

  await collectPaged(
    (offset) =>
      db
        .select({ blocks: contentProjects.blocks })
        .from(contentProjects)
        .where(eq(contentProjects.userId, userId))
        .limit(PAGE_SIZE)
        .offset(offset),
    (rows) => {
      for (const row of rows) {
        urls.push(...urlsFromProjectBlocks(row.blocks));
      }
    }
  );

  return collectUploadthingKeysFromSources({ urls, texts });
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/**
 * Best-effort blob purge. Missing token or UT API errors are logged and do
 * not block Neon/Clerk account deletion (PII in DB still must go).
 */
export async function deleteUserUploadthingFiles(
  userId: string
): Promise<{ keys: number }> {
  const keys = await collectUserUploadthingFileKeys(userId);
  if (keys.length === 0) {
    return { keys: 0 };
  }

  if (!process.env.UPLOADTHING_TOKEN) {
    console.error(
      "Skipping Uploadthing delete: UPLOADTHING_TOKEN is not set",
      { userId, keys: keys.length }
    );
    return { keys: keys.length };
  }

  try {
    const { UTApi } = await import("uploadthing/server");
    const utapi = new UTApi();
    for (const group of chunk(keys, DELETE_CHUNK_SIZE)) {
      const result = await utapi.deleteFiles(group);
      if (!result.success) {
        console.error("Uploadthing deleteFiles failed", {
          userId,
          requested: group.length,
          deletedCount: result.deletedCount,
        });
      }
    }
  } catch (error) {
    console.error("Uploadthing purge failed:", error, { userId });
  }

  return { keys: keys.length };
}
