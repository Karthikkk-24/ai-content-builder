import Link from "next/link";
import {
  Image,
  PenLine,
  Sparkles,
  MessageSquare,
  Wand2,
  Captions,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const tools = [
  {
    href: "/generate/posters",
    label: "Posters",
    description: "Generate poster designs with AI",
    icon: Image,
  },
  {
    href: "/generate/tweets",
    label: "Tweets",
    description: "Create engaging tweets and threads",
    icon: MessageSquare,
  },
  {
    href: "/generate/photos",
    label: "Photo Generator",
    description: "Generate photorealistic images",
    icon: Sparkles,
  },
  {
    href: "/generate/prompt-upgrade",
    label: "Prompt Upgrade",
    description: "Enhance your prompts for better results",
    icon: Wand2,
  },
  {
    href: "/generate/blog",
    label: "Blog Outline",
    description: "Generate structured blog outlines",
    icon: PenLine,
  },
  {
    href: "/generate/captions",
    label: "Social Captions",
    description: "Create captions for social media",
    icon: Captions,
  },
];

export default function GenerateHubPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">AI Generator</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Choose a tool to start generating content
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link key={tool.href} href={tool.href}>
              <Card className="h-full transition-colors hover:bg-zinc-50">
                <CardContent className="p-6">
                  <Icon className="h-5 w-5 text-zinc-900" strokeWidth={1.5} />
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
