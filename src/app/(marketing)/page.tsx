import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  FileText,
  Sparkles,
  Upload,
  Wand2,
} from "lucide-react";
import { RedirectIfSignedIn } from "@/components/auth/redirect-if-signed-in";
import { buttonVariants } from "@/components/ui/button-variants";
import { clerkConfig } from "@/lib/clerk-config";

export const dynamic = "force-dynamic";

const features = [
  {
    icon: FileText,
    title: "Content Builder",
    description:
      "Create rich content with a block-based editor. Headings, paragraphs, images, and CTAs.",
  },
  {
    icon: Sparkles,
    title: "AI Generation",
    description:
      "Generate posters, tweets, photos, and more with powerful AI models.",
  },
  {
    icon: Upload,
    title: "Reference Images",
    description:
      "Upload reference photos to guide AI and create content in a similar style.",
  },
  {
    icon: Wand2,
    title: "Prompt Upgrade",
    description:
      "Transform rough prompts into detailed, descriptive instructions for better results.",
  },
];

export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) {
    redirect(clerkConfig.afterSignInUrl);
  }

  return (
    <div className="min-h-screen bg-white">
      <RedirectIfSignedIn to={clerkConfig.afterSignInUrl} />

      <header className="border-b border-zinc-200">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center border border-zinc-900">
              <span className="text-xs font-bold">C</span>
            </div>
            <span className="text-sm font-semibold">ContentAI</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link
              href="/sign-in"
              className="text-sm text-zinc-600 hover:text-zinc-900"
            >
              Sign in
            </Link>
            <Link href="/sign-up" className={buttonVariants()}>
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-24 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl lg:text-6xl">
          Build & generate content
          <br />
          <span className="text-zinc-500">with AI</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-500">
          Create stunning posters, engaging tweets, photorealistic images, and
          polished content — all from one powerful platform.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link href="/sign-up" className={buttonVariants({ size: "lg" })}>
            Start creating
            <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
          </Link>
          <Link
            href="/sign-in"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            Sign in
          </Link>
        </div>
      </section>

      <section className="border-t border-zinc-200 bg-zinc-50 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-2xl font-semibold text-zinc-900">
            Everything you need to create
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="rounded-lg border border-zinc-200 bg-white p-6"
                >
                  <Icon className="h-5 w-5 text-zinc-900" strokeWidth={1.5} />
                  <h3 className="mt-4 text-sm font-semibold text-zinc-900">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm text-zinc-500">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-8 lg:p-12">
            <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
              <div>
                <h2 className="text-2xl font-semibold text-zinc-900">
                  AI-powered generation tools
                </h2>
                <p className="mt-4 text-zinc-500">
                  Posters, tweets, photos, blog outlines, social captions, and
                  prompt enhancement — all accessible from a single sidebar.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {["Posters", "Tweets", "Photos", "Prompts", "Blog", "Captions"].map(
                  (tool) => (
                    <div
                      key={tool}
                      className="flex items-center justify-center rounded-md border border-zinc-200 bg-white py-4 text-sm font-medium text-zinc-900"
                    >
                      {tool}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-zinc-200 bg-zinc-900 py-16 text-center text-white">
        <h2 className="text-2xl font-semibold">Ready to create?</h2>
        <p className="mt-2 text-zinc-400">
          Join ContentAI and start generating content today.
        </p>
        <Link
          href="/sign-up"
          className={buttonVariants({
            size: "lg",
            className: "mt-6 bg-white text-zinc-900 hover:bg-zinc-100",
          })}
        >
          Get started free
        </Link>
      </section>

      <footer className="border-t border-zinc-200 py-8 text-center text-sm text-zinc-500">
        ContentAI — Build & generate content with AI
      </footer>
    </div>
  );
}
