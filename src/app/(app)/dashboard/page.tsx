import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { getDashboardStats } from "@/lib/dashboard";
import { ONBOARDING_STEPS, PROMPT_TEMPLATES } from "@/lib/templates";
import {
  Captions,
  CheckCircle2,
  Circle,
  FileText,
  Image,
  MessageSquare,
  PenLine,
  Sparkles,
  Wand2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const quickActions = [
  { href: "/generate/posters", label: "Posters", icon: Image },
  { href: "/generate/tweets", label: "Tweets", icon: MessageSquare },
  { href: "/generate/photos", label: "Photos", icon: Sparkles },
  { href: "/generate/prompt-upgrade", label: "Prompt Upgrade", icon: Wand2 },
  { href: "/generate/blog", label: "Blog Outline", icon: PenLine },
  { href: "/generate/captions", label: "Social Captions", icon: Captions },
  { href: "/builder", label: "Content Builder", icon: FileText },
];

export default async function DashboardPage() {
  const { userId } = await auth();
  const stats = userId
    ? await getDashboardStats(userId)
    : { totalGenerations: 0, totalProjects: 0, weekGenerations: 0, recent: [] };

  const isFirstRun =
    stats.totalGenerations === 0 && stats.totalProjects === 0;

  const checklist = ONBOARDING_STEPS.map((step) => {
    const done =
      step.doneWhen === "always" ||
      (step.doneWhen === "hasGeneration" && stats.totalGenerations > 0) ||
      (step.doneWhen === "hasProject" && stats.totalProjects > 0);
    return { ...step, done };
  });
  const checklistDone = checklist.filter((s) => s.done).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Overview of your content and AI generations
        </p>
      </div>

      {isFirstRun && (
        <Card className="border-zinc-900/10 bg-white">
          <CardHeader>
            <CardTitle className="text-lg">Welcome to ContentAI</CardTitle>
            <CardDescription>
              Get started in a few minutes — pick a template or follow the
              checklist.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                Checklist ({checklistDone}/{checklist.length})
              </p>
              <ul className="space-y-2">
                {checklist.map((step) => (
                  <li key={step.id} className="flex items-center gap-2 text-sm">
                    {step.done ? (
                      <CheckCircle2 className="h-4 w-4 text-zinc-900" />
                    ) : (
                      <Circle className="h-4 w-4 text-zinc-400" />
                    )}
                    {step.done ? (
                      <span className="text-zinc-500 line-through">
                        {step.label}
                      </span>
                    ) : (
                      <Link
                        href={step.href}
                        className="text-zinc-900 underline-offset-2 hover:underline"
                      >
                        {step.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                Try a starter prompt
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {PROMPT_TEMPLATES.map((template) => (
                  <Link
                    key={template.id}
                    href={`${template.href}?prompt=${encodeURIComponent(template.prompt)}`}
                    className="block rounded-md border border-zinc-200 p-3 transition-colors hover:bg-zinc-50"
                  >
                    <p className="text-sm font-medium text-zinc-900">
                      {template.label}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {template.description}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
            <CardContent className="space-y-3 py-8 text-center text-sm text-zinc-500">
              <p>No generations yet. Start creating with AI tools.</p>
              <Link href="/generate/tweets">
                <Button size="sm" variant="outline">
                  Generate your first tweet
                </Button>
              </Link>
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
