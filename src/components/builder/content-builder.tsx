"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlignLeft,
  Heading1,
  Image as ImageIcon,
  Minus,
  MousePointerClick,
  Plus,
  Save,
  Copy,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { ContentBlock } from "@/lib/db/schema";

const blockTypes = [
  { type: "heading" as const, label: "Heading", icon: Heading1 },
  { type: "paragraph" as const, label: "Paragraph", icon: AlignLeft },
  { type: "image" as const, label: "Image", icon: ImageIcon },
  { type: "divider" as const, label: "Divider", icon: Minus },
  { type: "cta" as const, label: "CTA", icon: MousePointerClick },
];

function blocksToMarkdown(blocks: ContentBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "heading":
          return `${"#".repeat(block.level || 1)} ${block.content}\n`;
        case "paragraph":
          return `${block.content}\n`;
        case "image":
          return `![${block.content}](${block.url || ""})\n`;
        case "divider":
          return "---\n";
        case "cta":
          return `[${block.content}](${block.url || "#"})\n`;
        default:
          return "";
      }
    })
    .join("\n");
}

interface ContentBuilderProps {
  projectId?: string;
  initialTitle?: string;
  initialBlocks?: ContentBlock[];
}

export function ContentBuilder({
  projectId,
  initialTitle = "Untitled",
  initialBlocks = [],
}: ContentBuilderProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [blocks, setBlocks] = useState<ContentBlock[]>(initialBlocks);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const addBlock = (type: ContentBlock["type"]) => {
    const newBlock: ContentBlock = {
      id: crypto.randomUUID(),
      type,
      content: type === "heading" ? "New Heading" : type === "divider" ? "" : "New content",
      level: type === "heading" ? 2 : undefined,
      url: type === "image" || type === "cta" ? "" : undefined,
    };
    setBlocks([...blocks, newBlock]);
    setSelectedId(newBlock.id);
  };

  const updateBlock = (id: string, updates: Partial<ContentBlock>) => {
    setBlocks(blocks.map((b) => (b.id === id ? { ...b, ...updates } : b)));
  };

  const removeBlock = (id: string) => {
    setBlocks(blocks.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      if (projectId) {
        await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, blocks }),
        });
      } else {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, blocks }),
        });
        const data = await res.json();
        if (data.id) router.push(`/builder/${data.id}`);
      }
    } finally {
      setSaving(false);
    }
  }, [projectId, title, blocks, router]);

  const handleExport = () => {
    const md = blocksToMarkdown(blocks);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const selectedBlock = blocks.find((b) => b.id === selectedId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="max-w-md text-lg font-semibold border-transparent focus-visible:border-zinc-200"
        />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(blocksToMarkdown(blocks))}>
            <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />
            Copy MD
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="h-3.5 w-3.5" strokeWidth={1.5} />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-2">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-400">
            Blocks
          </p>
          <div className="space-y-1">
            {blockTypes.map((bt) => {
              const Icon = bt.icon;
              return (
                <button
                  key={bt.type}
                  onClick={() => addBlock(bt.type)}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                >
                  <Icon className="h-4 w-4" strokeWidth={1.5} />
                  {bt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="min-h-[400px] rounded-lg border border-zinc-200 bg-white p-6">
            {blocks.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center py-16 text-center">
                <Plus className="h-8 w-8 text-zinc-300" strokeWidth={1.5} />
                <p className="mt-4 text-sm text-zinc-500">
                  Add blocks from the left panel to start building
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {blocks.map((block) => (
                  <div
                    key={block.id}
                    onClick={() => setSelectedId(block.id)}
                    className={`cursor-pointer rounded-md p-3 transition-colors ${
                      selectedId === block.id
                        ? "bg-zinc-50 ring-1 ring-zinc-200"
                        : "hover:bg-zinc-50"
                    }`}
                  >
                    {block.type === "heading" && (
                      <h2 className="text-xl font-semibold">{block.content}</h2>
                    )}
                    {block.type === "paragraph" && (
                      <p className="text-sm text-zinc-600">{block.content}</p>
                    )}
                    {block.type === "image" && (
                      <div className="flex items-center gap-2 text-sm text-zinc-500">
                        <ImageIcon className="h-4 w-4" strokeWidth={1.5} />
                        {block.url || "No image URL"}
                      </div>
                    )}
                    {block.type === "divider" && <hr className="border-zinc-200" />}
                    {block.type === "cta" && (
                      <span className="inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm text-white">
                        {block.content}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-3">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-400">
            Properties
          </p>
          {selectedBlock ? (
            <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4">
              <div className="space-y-2">
                <Label>Content</Label>
                <Textarea
                  value={selectedBlock.content}
                  onChange={(e) =>
                    updateBlock(selectedBlock.id, { content: e.target.value })
                  }
                  rows={3}
                />
              </div>
              {selectedBlock.type === "heading" && (
                <div className="space-y-2">
                  <Label>Level</Label>
                  <select
                    value={selectedBlock.level || 2}
                    onChange={(e) =>
                      updateBlock(selectedBlock.id, {
                        level: Number(e.target.value),
                      })
                    }
                    className="flex h-10 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
                  >
                    <option value={1}>H1</option>
                    <option value={2}>H2</option>
                    <option value={3}>H3</option>
                  </select>
                </div>
              )}
              {(selectedBlock.type === "image" ||
                selectedBlock.type === "cta") && (
                <div className="space-y-2">
                  <Label>URL</Label>
                  <Input
                    value={selectedBlock.url || ""}
                    onChange={(e) =>
                      updateBlock(selectedBlock.id, { url: e.target.value })
                    }
                    placeholder="https://..."
                  />
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => removeBlock(selectedBlock.id)}
              >
                Remove Block
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-400">
              Select a block to edit
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
