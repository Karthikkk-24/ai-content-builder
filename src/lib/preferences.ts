import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userPreferences } from "@/lib/db/schema";

export const PREFERENCE_TONES = [
  "professional",
  "casual",
  "witty",
  "inspirational",
  "playful",
  "informative",
  "conversational",
  "technical",
  "storytelling",
] as const;

export const PREFERENCE_GENERATION_TYPES = [
  "tweet",
  "blog",
  "caption",
  "photo",
  "poster",
  "prompt_upgrade",
] as const;

export type UserPreferences = {
  defaultTone: string | null;
  defaultGenerationType: string | null;
  marketingOptOut: boolean;
  customAvatarUrl: string | null;
};

export const EMPTY_PREFERENCES: UserPreferences = {
  defaultTone: null,
  defaultGenerationType: null,
  marketingOptOut: false,
  customAvatarUrl: null,
};

export async function getUserPreferences(
  userId: string
): Promise<UserPreferences> {
  const [row] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  if (!row) return { ...EMPTY_PREFERENCES };

  return {
    defaultTone: row.defaultTone,
    defaultGenerationType: row.defaultGenerationType,
    marketingOptOut: row.marketingOptOut,
    customAvatarUrl: row.customAvatarUrl,
  };
}

export async function upsertUserPreferences(
  userId: string,
  patch: Partial<UserPreferences>
): Promise<UserPreferences> {
  const current = await getUserPreferences(userId);
  const next: UserPreferences = {
    defaultTone:
      patch.defaultTone !== undefined ? patch.defaultTone : current.defaultTone,
    defaultGenerationType:
      patch.defaultGenerationType !== undefined
        ? patch.defaultGenerationType
        : current.defaultGenerationType,
    marketingOptOut:
      patch.marketingOptOut !== undefined
        ? patch.marketingOptOut
        : current.marketingOptOut,
    customAvatarUrl:
      patch.customAvatarUrl !== undefined
        ? patch.customAvatarUrl
        : current.customAvatarUrl,
  };

  await db
    .insert(userPreferences)
    .values({
      userId,
      defaultTone: next.defaultTone,
      defaultGenerationType: next.defaultGenerationType,
      marketingOptOut: next.marketingOptOut,
      customAvatarUrl: next.customAvatarUrl,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: {
        defaultTone: next.defaultTone,
        defaultGenerationType: next.defaultGenerationType,
        marketingOptOut: next.marketingOptOut,
        customAvatarUrl: next.customAvatarUrl,
        updatedAt: new Date(),
      },
    });

  return next;
}
