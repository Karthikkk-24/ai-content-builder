import { currentUser } from "@clerk/nextjs/server";
import { cacheGet, cacheSet, CACHE_TTL, userCacheKeys } from "@/lib/cache";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { touchUserSession } from "@/lib/session";

export async function ensureUser(userId: string) {
  const keys = userCacheKeys(userId);
  const synced = await cacheGet<boolean>(keys.synced);
  if (synced) {
    await touchUserSession(userId);
    return;
  }

  const clerkUser = await currentUser();

  const email =
    clerkUser?.primaryEmailAddress?.emailAddress ||
    clerkUser?.emailAddresses?.[0]?.emailAddress ||
    `${userId}@clerk.local`;

  const name =
    [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") ||
    clerkUser?.username ||
    null;

  await db
    .insert(users)
    .values({
      id: userId,
      email,
      name,
      avatarUrl: clerkUser?.imageUrl ?? null,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email,
        name,
        avatarUrl: clerkUser?.imageUrl ?? null,
      },
    });

  await cacheSet(keys.synced, true, CACHE_TTL.USER_SYNC);
  await touchUserSession(userId);
}
