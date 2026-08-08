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

  if (userId) {
    try {
      await ensureUser(userId);
    } catch (error) {
      console.error("Failed to sync Clerk user to Neon:", error);
    }
  }

  const showRedisWarning =
    process.env.NODE_ENV === "production" && !isRedisConfigured();

  return (
    <AppShell showRedisWarning={showRedisWarning}>{children}</AppShell>
  );
}
