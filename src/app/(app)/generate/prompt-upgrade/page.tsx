"use client";

import { useState } from "react";
import { Copy, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ReferenceImageUploader } from "@/components/upload/reference-image-uploader";

export default function PromptUpgradePage() {
  const [prompt, setPrompt] = useState("");
  const [enhanced, setEnhanced] = useState("");
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [generationType, setGenerationType] = useState("general");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpgrade = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/prompt-upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          context: { generationType },
          referenceImageUrl: referenceImage,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setEnhanced(data.enhanced);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Prompt Upgrade</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Transform rough prompts into detailed, descriptive instructions
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your Prompt</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Generation Type</Label>
              <select
                value={generationType}
                onChange={(e) => setGenerationType(e.target.value)}
                className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
              >
                <option value="general">General</option>
                <option value="poster">Poster</option>
                <option value="photo">Photo</option>
                <option value="tweet">Tweet</option>
              </select>
            </div>
            <Textarea
              placeholder="Enter your rough prompt..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={8}
            />
            <Button onClick={handleUpgrade} disabled={loading || !prompt.trim()}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
              ) : (
                <Sparkles className="h-4 w-4" strokeWidth={1.5} />
              )}
              Upgrade Prompt
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reference Image</CardTitle>
          </CardHeader>
          <CardContent>
            <ReferenceImageUploader
              value={referenceImage}
              onChange={setReferenceImage}
            />
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
          {error}
        </div>
      )}

      {enhanced && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Enhanced Prompt</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigator.clipboard.writeText(enhanced)}
            >
              <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />
              Copy
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label className="text-zinc-400">Original</Label>
                <p className="mt-1 text-sm text-zinc-500 line-through">
                  {prompt}
                </p>
              </div>
              <div>
                <Label>Enhanced</Label>
                <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-900">
                  {enhanced}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
