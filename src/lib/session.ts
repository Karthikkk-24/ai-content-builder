import { auth, currentUser } from "@clerk/nextjs/server";
import {
  CACHE_TTL,
  cacheGet,
  cacheSet,
  userCacheKeys,
} from "@/lib/cache";
import { clerkConfig } from "@/lib/clerk-config";
import { getUserPreferences } from "@/lib/preferences";

export type CachedUserProfile = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
};

export type UserSessionActivity = {
  activeAt: number;
};

export type SessionStatus = {
  activeAt: number | null;
  maxAgeDays: number;
  /** True when Redis has a recent activity stamp within the configured max age. */
  isActive: boolean;
};

export function isSessionWithinMaxAge(
  activeAt: number,
  now = Date.now(),
  maxAgeMs = CACHE_TTL.SESSION * 1000
): boolean {
  return now - activeAt <= maxAgeMs;
}

export async function getUserSessionActivity(
  userId: string
): Promise<UserSessionActivity | null> {
  const keys = userCacheKeys(userId);
  const stored = await cacheGet<UserSessionActivity>(keys.session);
  if (!stored || typeof stored.activeAt !== "number") {
    return null;
  }
  return stored;
}

export async function getSessionStatus(userId: string): Promise<SessionStatus> {
  const activity = await getUserSessionActivity(userId);
  const activeAt = activity?.activeAt ?? null;
  const isActive =
    activeAt !== null && isSessionWithinMaxAge(activeAt);

  return {
    activeAt,
    maxAgeDays: clerkConfig.sessionMaxAgeDays,
    isActive,
  };
}

export async function touchUserSession(
  userId: string
): Promise<UserSessionActivity> {
  const keys = userCacheKeys(userId);
  const activity: UserSessionActivity = { activeAt: Date.now() };
  await cacheSet(keys.session, activity, CACHE_TTL.SESSION);
  return activity;
}

export async function getCachedUserProfile(
  userId: string
): Promise<CachedUserProfile | null> {
  const keys = userCacheKeys(userId);
  return cacheGet<CachedUserProfile>(keys.profile);
}

export async function cacheUserProfile(userId: string, profile: CachedUserProfile) {
  const keys = userCacheKeys(userId);
  await cacheSet(keys.profile, profile, CACHE_TTL.USER_PROFILE);
}

export async function resolveUserProfile(): Promise<CachedUserProfile | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const cached = await getCachedUserProfile(userId);
  if (cached) {
    await touchUserSession(userId);
    return cached;
  }

  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  let customAvatarUrl: string | null = null;
  try {
    const prefs = await getUserPreferences(userId);
    customAvatarUrl = prefs.customAvatarUrl;
  } catch {
    // Preferences lookup is best-effort for avatar display.
  }

  const profile: CachedUserProfile = {
    id: userId,
    email:
      clerkUser.primaryEmailAddress?.emailAddress ||
      clerkUser.emailAddresses[0]?.emailAddress ||
      `${userId}@clerk.local`,
    name:
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
      clerkUser.username ||
      null,
    avatarUrl: customAvatarUrl ?? clerkUser.imageUrl ?? null,
  };

  await cacheUserProfile(userId, profile);
  await touchUserSession(userId);
  return profile;
}
