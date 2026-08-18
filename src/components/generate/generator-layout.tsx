"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Copy,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { ReferenceImageUploader } from "@/components/upload/reference-image-uploader";
import { getApiErrorMessage } from "@/lib/api/client-error";

interface ContextField {
  key: string;
  label: string;
  type: "text" | "select" | "toggle";
  options?: string[];
  placeholder?: string;
}

class StreamOpenedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StreamOpenedError";
  }
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
  charLimit?: number;
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
  charLimit,
}: GeneratorLayoutProps) {
  const searchParams = useSearchParams();
  const [prompt, setPrompt] = useState(
    () => searchParams.get("prompt")?.trim() ?? ""
  );
  const [context, setContext] = useState<Record<string, string>>({});
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [remarks, setRemarks] = useState("");
  const [output, setOutput] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [previousOutput, setPreviousOutput] = useState<string | null>(null);
  const [styleFingerprint, setStyleFingerprint] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const toneField = contextFields.find((field) => field.key === "tone");
    if (!toneField?.options?.length) return;

    void (async () => {
      try {
        const res = await fetch("/api/preferences");
        if (!res.ok) return;
        const data = (await res.json()) as { defaultTone?: string | null };
        const preferred = data.defaultTone;
        if (
          !preferred ||
          cancelled ||
          !toneField.options?.includes(preferred)
        ) {
          return;
        }
        setContext((prev) =>
          prev.tone ? prev : { ...prev, tone: preferred }
        );
      } catch {
        // Preferences are optional defaults.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [contextFields]);

  const isThreadMode = context.threadMode === "thread";
  const promptOverLimit = Boolean(
    charLimit && !isThreadMode && prompt.length > charLimit
  );
  const canGenerate = Boolean(prompt.trim()) && !promptOverLimit;

  const runGeneration = async (regenerate = false) => {
    if (!canGenerate) return;
    setLoading(true);
    setError(null);
    if (!regenerate) {
      setOutput(null);
      setProjectId(null);
      setPreviousOutput(null);
      setStyleFingerprint(null);
      setRemarks("");
    } else if (outputType === "image" && output) {
      setPreviousOutput(output);
    }

    const payload: Record<string, unknown> = {
      prompt,
      context: { ...context, generationType },
      referenceImageUrl: referenceImage,
      ...extraPayload,
    };

    if (regenerate && remarks.trim()) {
      payload.remarks = remarks.trim();
    }

    if (regenerate && outputType === "image") {
      payload.previousOutputUrl = previousOutput || output;
      if (styleFingerprint) {
        payload.previousStyle = styleFingerprint;
      }
    }

    try {
      if (outputType === "text") {
        try {
          await runTextStream(payload);
          return;
        } catch (streamErr) {
          if (streamErr instanceof StreamOpenedError) {
            throw streamErr;
          }
          console.warn("Stream generate failed; falling back to JSON", streamErr);
        }
      }

      const res = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, stream: false }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(getApiErrorMessage(data, "Generation failed"));
      }
      setOutput(data.output);
      if (typeof data.projectId === "string" && data.projectId) {
        setProjectId(data.projectId);
      }
      if (outputType === "image" && data.style) {
        setStyleFingerprint(data.style);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  const runTextStream = async (payload: Record<string, unknown>) => {
    const res = await fetch(apiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({ ...payload, stream: true }),
    });

    const contentType = res.headers.get("content-type") || "";
    if (!res.ok || !contentType.includes("text/event-stream")) {
      // Non-stream error or unexpected JSON response.
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(getApiErrorMessage(data, "Generation failed"));
      }
      if (data?.output) {
        setOutput(data.output);
        if (typeof data.projectId === "string" && data.projectId) {
          setProjectId(data.projectId);
        }
        return;
      }
      throw new Error("Streaming response was not available");
    }

    if (!res.body) {
      throw new StreamOpenedError("Empty stream body");
    }

    try {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let sawDone = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const line = part
            .split("\n")
            .find((l) => l.startsWith("data: "));
          if (!line) continue;
          const json = line.slice(6).trim();
          if (!json) continue;
          let event: {
            type: string;
            output?: string;
            projectId?: string;
            message?: string;
          };
          try {
            event = JSON.parse(json);
          } catch {
            continue;
          }

          if (event.type === "done" && typeof event.output === "string") {
            setOutput(event.output);
            if (typeof event.projectId === "string" && event.projectId) {
              setProjectId(event.projectId);
            }
            sawDone = true;
          } else if (event.type === "error") {
            setOutput(null);
            throw new StreamOpenedError(
              event.message || "Streaming generation failed"
            );
          }
        }
      }

      if (!sawDone) {
        setOutput(null);
        throw new StreamOpenedError("Stream ended before completion");
      }
    } catch (err) {
      setOutput(null);
      if (err instanceof StreamOpenedError) throw err;
      throw new StreamOpenedError(
        err instanceof Error ? err.message : "Streaming generation failed"
      );
    }
  };

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
      if (!res.ok) {
        throw new Error(getApiErrorMessage(data, "Failed to upgrade prompt"));
      }
      setPrompt(data.enhanced);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upgrade prompt");
    } finally {
      setUpgrading(false);
    }
  };

  const handleCopy = async () => {
    if (!output) return;

    const textToCopy =
      outputType === "image" && output.startsWith("data:")
        ? "Generated image is ready. Use Download to save the file."
        : output;

    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
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
            {charLimit && (
              <p
                className={`text-xs ${
                  promptOverLimit ? "text-zinc-900 font-medium" : "text-zinc-400"
                }`}
              >
                {prompt.length} / {charLimit} characters
                {promptOverLimit ? " — shorten for a single tweet, or switch to thread" : ""}
              </p>
            )}
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

      <Button onClick={() => runGeneration(false)} disabled={loading || !canGenerate}>
        {loading && !output ? (
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
        ) : (
          <Sparkles className="h-4 w-4" strokeWidth={1.5} />
        )}
        {loading && !output ? "Generating..." : "Generate"}
      </Button>

      {loading && !output && (
        <div className="flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
          Generating your content...
        </div>
      )}

      {loading && output && (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
          Regenerating with your latest prompt
          {remarks.trim() ? " and remarks" : ""}...
        </div>
      )}

      {!loading && !output && !error && (
        <p className="text-sm text-zinc-400">
          Output will appear here after you generate.
        </p>
      )}

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
              {projectId && (
                <Link href={`/builder/${projectId}`}>
                  <Button variant="outline" size="sm" type="button">
                    <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Open in Builder
                  </Button>
                </Link>
              )}
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />
                {copied ? "Copied" : "Copy"}
              </Button>
              {outputType === "image" && (
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Download
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={loading ? "pointer-events-none opacity-50" : ""}>
            {outputType === "image" ? (
              <div className="space-y-3">
                {previousOutput && previousOutput !== output ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-400">
                        Previous
                      </p>
                      <div className="relative aspect-square overflow-hidden rounded-lg border border-zinc-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={previousOutput}
                          alt="Previous generation"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-400">
                        Current
                      </p>
                      <div className="relative aspect-square overflow-hidden rounded-lg border border-zinc-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={output}
                          alt="Generated"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="relative aspect-square max-w-lg overflow-hidden rounded-lg border border-zinc-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={output}
                      alt="Generated"
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                {styleFingerprint &&
                typeof styleFingerprint === "object" &&
                styleFingerprint !== null &&
                "moodWords" in styleFingerprint &&
                Array.isArray((styleFingerprint as { moodWords?: unknown }).moodWords) &&
                ((styleFingerprint as { moodWords: string[] }).moodWords).length >
                  0 ? (
                  <p className="text-xs text-zinc-500">
                    Style continuity cues:{" "}
                    {(styleFingerprint as { moodWords: string[] }).moodWords.join(
                      ", "
                    )}
                  </p>
                ) : null}
              </div>
            ) : (
              <div>
                <MarkdownRenderer content={output} />
                {charLimit && output && (
                  <p className="mt-2 text-xs text-zinc-400">
                    Output length: {output.length} characters
                  </p>
                )}
              </div>
            )}

            </div>

            <div className="space-y-2 border-t border-zinc-100 pt-4">
              <Label htmlFor="remarks">Remarks (optional)</Label>
              <Textarea
                id="remarks"
                placeholder="e.g. Make it shorter, use a more casual tone, emphasize the product name..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-zinc-400">
                Add feedback before regenerating. Remarks are only used when you click Regenerate.
              </p>
            </div>

            <Button
              variant="outline"
              onClick={() => runGeneration(true)}
              disabled={loading || !canGenerate}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
              ) : (
                <RefreshCw className="h-4 w-4" strokeWidth={1.5} />
              )}
              Regenerate
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
