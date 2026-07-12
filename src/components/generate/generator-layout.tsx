"use client";

import { useState } from "react";
import { Copy, Download, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ReferenceImageUploader } from "@/components/upload/reference-image-uploader";

interface ContextField {
  key: string;
  label: string;
  type: "text" | "select" | "toggle";
  options?: string[];
  placeholder?: string;
}

interface GeneratorLayoutProps {
  title: string;
  description: string;
  generationType: string;
  apiEndpoint: string;
  contextFields?: ContextField[];
  showReferenceImage?: boolean;
  showPromptUpgrade?: boolean;
  outputType?: "text" | "image";
  extraPayload?: Record<string, unknown>;
  children?: React.ReactNode;
}

export function GeneratorLayout({
  title,
  description,
  generationType,
  apiEndpoint,
  contextFields = [],
  showReferenceImage = true,
  showPromptUpgrade = true,
  outputType = "text",
  extraPayload = {},
}: GeneratorLayoutProps) {
  const [prompt, setPrompt] = useState("");
  const [context, setContext] = useState<Record<string, string>>({});
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [output, setOutput] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpgradePrompt = async () => {
    if (!prompt.trim()) return;
    setUpgrading(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/prompt-upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          context: { ...context, generationType },
          referenceImageUrl: referenceImage,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to upgrade prompt");
      setPrompt(data.enhanced);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upgrade prompt");
    } finally {
      setUpgrading(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setOutput(null);

    try {
      const res = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          context: { ...context, generationType },
          referenceImageUrl: referenceImage,
          ...extraPayload,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setOutput(data.output);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (output) navigator.clipboard.writeText(output);
  };

  const handleDownload = () => {
    if (!output || outputType !== "image") return;
    const link = document.createElement("a");
    link.href = output;
    link.download = `${generationType}-${Date.now()}.png`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">{title}</h1>
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      </div>

      {contextFields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Context</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {contextFields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label>{field.label}</Label>
                  {field.type === "select" && field.options ? (
                    <select
                      value={context[field.key] || field.options[0]}
                      onChange={(e) =>
                        setContext({ ...context, [field.key]: e.target.value })
                      }
                      className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
                    >
                      {field.options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      placeholder={field.placeholder}
                      value={context[field.key] || ""}
                      onChange={(e) =>
                        setContext({ ...context, [field.key]: e.target.value })
                      }
                    />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prompt</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Describe what you want to generate..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
            />
            {showPromptUpgrade && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleUpgradePrompt}
                disabled={upgrading || !prompt.trim()}
              >
                {upgrading ? (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                ) : (
                  <Sparkles className="h-4 w-4" strokeWidth={1.5} />
                )}
                Upgrade Prompt
              </Button>
            )}
          </CardContent>
        </Card>

        {showReferenceImage && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Reference Image</CardTitle>
            </CardHeader>
            <CardContent>
              <ReferenceImageUploader
                value={referenceImage}
                onChange={setReferenceImage}
              />
              <p className="mt-2 text-xs text-zinc-400">
                Optional. Upload a reference to create something similar.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <Button onClick={handleGenerate} disabled={loading || !prompt.trim()}>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
        ) : (
          <Sparkles className="h-4 w-4" strokeWidth={1.5} />
        )}
        Generate
      </Button>

      {error && (
        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
          {error}
        </div>
      )}

      {output && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Output</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />
                Copy
              </Button>
              {outputType === "image" && (
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Download
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {outputType === "image" ? (
              <div className="relative aspect-square max-w-lg overflow-hidden rounded-lg border border-zinc-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={output}
                  alt="Generated"
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <pre className="whitespace-pre-wrap rounded-md bg-zinc-50 p-4 text-sm text-zinc-900">
                {output}
              </pre>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
