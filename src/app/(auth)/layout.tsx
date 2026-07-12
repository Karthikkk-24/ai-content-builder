import { clerkConfig } from "@/lib/clerk-config";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-zinc-50">{children}</div>;
}

export { clerkConfig };
