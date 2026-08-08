import { auth } from "@clerk/nextjs/server";
import { getCachedGenerations } from "@/lib/dashboard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { scrubProviderSecretsFromUrl } from "@/lib/image-utils";
import Link from "next/link";

export default async function GenerationsPage() {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  const generations = await getCachedGenerations(userId, 100);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Generation History</h1>
        <p className="mt-1 text-sm text-zinc-500">
          All your AI-generated content, ordered by newest first.
        </p>
      </div>

      {generations.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-zinc-500">
            No generations yet. Create your first tweet, poster, or blog.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {generations.map((gen) => {
            const safeOutput = scrubProviderSecretsFromUrl(gen.outputContent);
            return (
              <Card key={gen.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium capitalize text-zinc-800">
                        {gen.type.replace("_", " ")}
                      </span>
                      <p className="mt-1 text-sm text-zinc-900 line-clamp-1">
                        {gen.inputPrompt}
                      </p>
                      {gen.referenceImageUrl && (
                        <p className="mt-1 text-xs text-zinc-500">
                          Ref: {gen.referenceImageUrl}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {safeOutput.startsWith("http") && (
                        <Button variant="outline" size="sm">
                          <a
                            href={safeOutput}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center"
                          >
                            View
                          </a>
                        </Button>
                      )}
                      <p className="text-xs text-zinc-400">
                        {new Date(gen.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Link href="/generate">
          <Button variant="outline" size="sm">
            Back to generators
          </Button>
        </Link>
      </div>
    </div>
  );
}
