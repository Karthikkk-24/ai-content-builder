import { auth, currentUser } from "@clerk/nextjs/server";
import {
  CACHE_TTL,
  cacheGet,
  cacheSet,
  userCacheKeys,
} from "@/lib/cache";

export type CachedUserProfile = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
};

export async function touchUserSession(userId: string) {
  const keys = userCacheKeys(userId);
  await cacheSet(keys.session, { activeAt: Date.now() }, CACHE_TTL.SESSION);
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
    avatarUrl: clerkUser.imageUrl ?? null,
  };

  await cacheUserProfile(userId, profile);
  await touchUserSession(userId);
  return profile;
}
