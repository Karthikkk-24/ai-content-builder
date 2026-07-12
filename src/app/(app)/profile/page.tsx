import { auth, currentUser } from "@clerk/nextjs/server";
import { eq, desc } from "drizzle-orm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/lib/db";
import { generations } from "@/lib/db/schema";

async function getUserGenerations(userId: string) {
  try {
    return await db
      .select()
      .from(generations)
      .where(eq(generations.userId, userId))
      .orderBy(desc(generations.createdAt))
      .limit(20);
  } catch {
    return [];
  }
}

export default async function ProfilePage() {
  const user = await currentUser();
  const { userId } = await auth();
  const userGenerations = userId ? await getUserGenerations(userId) : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Profile</h1>
        <p className="mt-1 text-sm text-zinc-500">Your account and generation history</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>Managed via Clerk</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4">
            {user?.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.imageUrl}
                alt="Avatar"
                className="h-16 w-16 rounded-full border border-zinc-200"
              />
            )}
            <div>
              <p className="font-medium text-zinc-900">
                {user?.fullName || "User"}
              </p>
              <p className="text-sm text-zinc-500">
                {user?.primaryEmailAddress?.emailAddress}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">
          Generation History
        </h2>
        {userGenerations.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-zinc-500">
              No generations yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {userGenerations.map((gen) => (
              <Card key={gen.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium capitalize text-zinc-900">
                      {gen.type.replace("_", " ")}
                    </span>
                    <span className="text-xs text-zinc-400">
                      {new Date(gen.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm text-zinc-500">
                    {gen.inputPrompt}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
