import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCachedGenerations } from "@/lib/dashboard";
import { getUserPreferences } from "@/lib/preferences";
import { resolveUserProfile } from "@/lib/session";
import { ensureUser } from "@/lib/db/users";

export default async function ProfilePage() {
  const { userId } = await auth();
  if (!userId) return null;

  await ensureUser(userId);
  const [profile, preferences] = await Promise.all([
    resolveUserProfile(),
    getUserPreferences(userId),
  ]);

  let userGenerations: Awaited<ReturnType<typeof getCachedGenerations>> = [];
  let generationsError: string | null = null;
  try {
    userGenerations = await getCachedGenerations(userId, 20);
  } catch {
    generationsError =
      "Couldn't load generation history right now. Refresh to try again.";
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Profile</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Your account and generation history
          </p>
        </div>
        <Link
          href="/settings"
          className="inline-flex h-9 items-center rounded-md border border-zinc-200 px-3 text-sm text-zinc-700 hover:bg-zinc-50"
        >
          Edit settings
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>
            {preferences.customAvatarUrl
              ? "Custom avatar from Settings"
              : "Avatar from Clerk (upload a custom one in Settings)"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4">
            {profile?.avatarUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatarUrl}
                alt="Avatar"
                className="h-16 w-16 rounded-full border border-zinc-200 object-cover"
              />
            )}
            <div>
              <p className="font-medium text-zinc-900">
                {profile?.name || "User"}
              </p>
              <p className="text-sm text-zinc-500">{profile?.email}</p>
            </div>
          </div>
          <dl className="grid gap-2 text-sm text-zinc-600 sm:grid-cols-2">
            <div>
              <dt className="text-zinc-400">Default tone</dt>
              <dd>{preferences.defaultTone || "Not set"}</dd>
            </div>
            <div>
              <dt className="text-zinc-400">Preferred tool</dt>
              <dd>{preferences.defaultGenerationType || "Not set"}</dd>
            </div>
            <div>
              <dt className="text-zinc-400">Marketing emails</dt>
              <dd>{preferences.marketingOptOut ? "Opted out" : "Allowed"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">
          Generation History
        </h2>
        {generationsError ? (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {generationsError}
          </div>
        ) : userGenerations.length === 0 ? (
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
