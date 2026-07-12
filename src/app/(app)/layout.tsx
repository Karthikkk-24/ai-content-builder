import { auth } from "@clerk/nextjs/server";
import { AppShell } from "@/components/layout/app-shell";
import { ensureUser } from "@/lib/db/users";

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

  return <AppShell>{children}</AppShell>;
}
