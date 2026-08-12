import { auth } from "@clerk/nextjs/server";
import { AppShell } from "@/components/layout/app-shell";
import { ensureUser } from "@/lib/db/users";
import { isRedisConfigured } from "@/lib/redis";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  const showRedisWarning =
    process.env.NODE_ENV === "production" && !isRedisConfigured();

  if (userId) {
    try {
      await ensureUser(userId);
    } catch (error) {
      console.error("Failed to sync Clerk user to Neon:", error);
      // Do not render authenticated app routes without a users row — FK inserts
      // on generate/builder would fail and look like random AI errors.
      return (
        <AppShell showRedisWarning={showRedisWarning}>
          <div
            role="alert"
            className="mx-auto max-w-lg rounded-md border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-900"
          >
            <p className="font-medium">Account sync failed</p>
            <p className="mt-2 text-red-800">
              We couldn&apos;t sync your account to the database. Refresh the
              page, or try again in a moment. If this keeps happening, sign out
              and sign back in.
            </p>
          </div>
        </AppShell>
      );
    }
  }

  return (
    <AppShell showRedisWarning={showRedisWarning}>{children}</AppShell>
  );
}
