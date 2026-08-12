import { currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { cacheGet, cacheSet, CACHE_TTL, userCacheKeys } from "@/lib/cache";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { touchUserSession } from "@/lib/session";

function syntheticEmail(userId: string) {
  return `${userId}@clerk.local`;
}

export async function ensureUser(userId: string) {
  const keys = userCacheKeys(userId);
  const synced = await cacheGet<boolean>(keys.synced);
  if (synced) {
    await touchUserSession(userId);
    return;
  }

  const clerkUser = await currentUser();
  const emailFromClerk =
    clerkUser?.primaryEmailAddress?.emailAddress ||
    clerkUser?.emailAddresses?.[0]?.emailAddress ||
    null;

  const name =
    [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") ||
    clerkUser?.username ||
    null;

  const avatarUrl = clerkUser?.imageUrl ?? null;

  const [existing] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!existing) {
    await db.insert(users).values({
      id: userId,
      // Only use the synthetic placeholder for brand-new rows when Clerk
      // profile is unavailable — never use it to overwrite a real email.
      email: emailFromClerk ?? syntheticEmail(userId),
      name,
      avatarUrl,
    });
  } else if (emailFromClerk || name || avatarUrl) {
    // Never overwrite a real email with @clerk.local on Clerk miss.
    await db
      .update(users)
      .set({
        ...(emailFromClerk ? { email: emailFromClerk } : {}),
        ...(name ? { name } : {}),
        ...(avatarUrl ? { avatarUrl } : {}),
      })
      .where(eq(users.id, userId));
  }

  await cacheSet(keys.synced, true, CACHE_TTL.USER_SYNC);
  await touchUserSession(userId);
}
