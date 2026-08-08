import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import {
  Image,
  PenLine,
  Sparkles,
  MessageSquare,
  Wand2,
  Captions,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ensureUser } from "@/lib/db/users";
import { getUserPreferences } from "@/lib/preferences";
import { cn } from "@/lib/utils";

const tools = [
  {
    href: "/generate/posters",
    label: "Posters",
    description: "Generate poster designs with AI",
    icon: Image,
    type: "poster",
  },
  {
    href: "/generate/tweets",
    label: "Tweets",
    description: "Create engaging tweets and threads",
    icon: MessageSquare,
    type: "tweet",
  },
  {
    href: "/generate/photos",
    label: "Photo Generator",
    description: "Generate photorealistic images",
    icon: Sparkles,
    type: "photo",
  },
  {
    href: "/generate/prompt-upgrade",
    label: "Prompt Upgrade",
    description: "Enhance your prompts for better results",
    icon: Wand2,
    type: "prompt_upgrade",
  },
  {
    href: "/generate/blog",
    label: "Blog Outline",
    description: "Generate structured blog outlines",
    icon: PenLine,
    type: "blog",
  },
  {
    href: "/generate/captions",
    label: "Social Captions",
    description: "Create captions for social media",
    icon: Captions,
    type: "caption",
  },
] as const;

export default async function GenerateHubPage() {
  const { userId } = await auth();
  let preferredType: string | null = null;
  if (userId) {
    await ensureUser(userId);
    const prefs = await getUserPreferences(userId);
    preferredType = prefs.defaultGenerationType;
  }

  const orderedTools = preferredType
    ? [
        ...tools.filter((t) => t.type === preferredType),
        ...tools.filter((t) => t.type !== preferredType),
      ]
    : [...tools];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">AI Generator</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Choose a tool to start generating content
          {preferredType
            ? " — your preferred tool is listed first"
            : ""}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {orderedTools.map((tool) => {
          const Icon = tool.icon;
          const isPreferred = tool.type === preferredType;
          return (
            <Link key={tool.href} href={tool.href}>
              <Card
                className={cn(
                  "h-full transition-colors hover:bg-zinc-50",
                  isPreferred && "ring-1 ring-zinc-900"
                )}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between gap-2">
                    <Icon
                      className="h-5 w-5 text-zinc-900"
                      strokeWidth={1.5}
                    />
                    {isPreferred ? (
                      <span className="text-xs font-medium text-zinc-500">
                        Preferred
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-zinc-900">
                    {tool.label}
                  </h3>
                  <p className="mt-1 text-sm text-zinc-500">
                    {tool.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
