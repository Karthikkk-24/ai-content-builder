import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { getDashboardStats } from "@/lib/dashboard";
import {
  FileText,
  Image,
  Sparkles,
  MessageSquare,
  Wand2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const quickActions = [
  { href: "/generate/posters", label: "Posters", icon: Image },
  { href: "/generate/tweets", label: "Tweets", icon: MessageSquare },
  { href: "/generate/photos", label: "Photos", icon: Sparkles },
  { href: "/generate/prompt-upgrade", label: "Prompt Upgrade", icon: Wand2 },
  { href: "/builder", label: "Content Builder", icon: FileText },
];

export default async function DashboardPage() {
  const { userId } = await auth();
  const stats = userId
    ? await getDashboardStats(userId)
    : { totalGenerations: 0, totalProjects: 0, weekGenerations: 0, recent: [] };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Overview of your content and AI generations
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Generations</CardDescription>
            <CardTitle className="text-3xl">{stats.totalGenerations}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Saved Projects</CardDescription>
            <CardTitle className="text-3xl">{stats.totalProjects}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>This Week</CardDescription>
            <CardTitle className="text-3xl">{stats.weekGenerations}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">Quick Actions</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.href} href={action.href}>
                <Card className="transition-colors hover:bg-zinc-50">
                  <CardContent className="flex items-center gap-3 p-4">
                    <Icon className="h-5 w-5 text-zinc-900" strokeWidth={1.5} />
                    <span className="text-sm font-medium">{action.label}</span>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">Recent Activity</h2>
        {stats.recent.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-zinc-500">
              No generations yet. Start creating with AI tools.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {stats.recent.map((gen) => (
              <Card key={gen.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-medium capitalize text-zinc-900">
                      {gen.type.replace("_", " ")}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-zinc-500 max-w-md">
                      {gen.inputPrompt}
                    </p>
                  </div>
                  <span className="text-xs text-zinc-400">
                    {new Date(gen.createdAt).toLocaleDateString()}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
