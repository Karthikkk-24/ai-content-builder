import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export async function ensureUser(userId: string) {
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
}
