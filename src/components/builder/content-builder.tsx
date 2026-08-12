"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlignLeft,
  GripVertical,
  Heading1,
  Image as ImageIcon,
  Keyboard,
  Link2,
  Minus,
  MousePointerClick,
  Plus,
  Save,
  Copy,
  Download,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/lib/api/client-error";
import type { ContentBlock } from "@/lib/db/schema";
import { isAllowedContentImageUrl } from "@/lib/content-blocks";
import { blocksToMarkdown } from "@/lib/markdown-export";

const blockTypes = [
  { type: "heading" as const, label: "Heading", icon: Heading1 },
  { type: "paragraph" as const, label: "Paragraph", icon: AlignLeft },
  { type: "image" as const, label: "Image", icon: ImageIcon },
  { type: "divider" as const, label: "Divider", icon: Minus },
  { type: "cta" as const, label: "CTA", icon: MousePointerClick },
];

const SHORTCUTS = [
  { keys: "⌘/Ctrl + Enter", action: "Add paragraph after selection" },
  { keys: "⌘/Ctrl + D", action: "Duplicate selected block" },
  { keys: "⌘/Ctrl + Backspace", action: "Delete selected block" },
  { keys: "↑ / ↓", action: "Move block selection" },
  { keys: "?", action: "Toggle this shortcut legend" },
];

function createBlock(type: ContentBlock["type"]): ContentBlock {
  return {
    id: crypto.randomUUID(),
    type,
    content:
      type === "heading"
        ? "New Heading"
        : type === "divider"
          ? ""
          : "New content",
    level: type === "heading" ? 2 : undefined,
    url: type === "image" || type === "cta" ? "" : undefined,
  };
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

interface ContentBuilderProps {
  projectId?: string;
  initialTitle?: string;
  initialBlocks?: ContentBlock[];
  initialIsPublic?: boolean;
}

export function ContentBuilder({
  projectId,
  initialTitle = "Untitled",
  initialBlocks = [],
  initialIsPublic = false,
}: ContentBuilderProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [blocks, setBlocks] = useState<ContentBlock[]>(initialBlocks);
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [focusToken, setFocusToken] = useState(0);

  const contentFieldRef = useRef<HTMLTextAreaElement>(null);
  const blocksRef = useRef(blocks);
  const selectedIdRef = useRef(selectedId);

  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId || focusToken === 0) return;
    // Focus after paint so the properties panel is mounted for the new selection.
    const frame = requestAnimationFrame(() => {
      contentFieldRef.current?.focus();
      contentFieldRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedId, focusToken]);

  const selectAndFocus = useCallback((id: string) => {
    setSelectedId(id);
    setFocusToken((token) => token + 1);
  }, []);

  const addBlock = useCallback(
    (type: ContentBlock["type"], afterId?: string | null) => {
      const newBlock = createBlock(type);
      setBlocks((prev) => {
        const anchor = afterId ?? selectedIdRef.current;
        if (!anchor) return [...prev, newBlock];
        const index = prev.findIndex((b) => b.id === anchor);
        if (index === -1) return [...prev, newBlock];
        const next = [...prev];
        next.splice(index + 1, 0, newBlock);
        return next;
      });
      selectAndFocus(newBlock.id);
    },
    [selectAndFocus]
  );

  const duplicateBlock = useCallback(
    (id: string) => {
      const source = blocksRef.current.find((b) => b.id === id);
      if (!source) return;
      const copy: ContentBlock = {
        ...source,
        id: crypto.randomUUID(),
      };
      setBlocks((prev) => {
        const index = prev.findIndex((b) => b.id === id);
        if (index === -1) return [...prev, copy];
        const next = [...prev];
        next.splice(index + 1, 0, copy);
        return next;
      });
      selectAndFocus(copy.id);
    },
    [selectAndFocus]
  );

  const updateBlock = (id: string, updates: Partial<ContentBlock>) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...updates } : b))
    );
  };

  const removeBlock = useCallback((id: string) => {
    const prev = blocksRef.current;
    const index = prev.findIndex((b) => b.id === id);
    const next = prev.filter((b) => b.id !== id);
    setBlocks(next);
    if (selectedIdRef.current === id) {
      const neighbor = next[index] ?? next[index - 1] ?? null;
      setSelectedId(neighbor?.id ?? null);
    }
  }, []);

  const moveSelection = useCallback((delta: -1 | 1) => {
    const current = blocksRef.current;
    if (current.length === 0) return;
    const selected = selectedIdRef.current;
    const index = selected
      ? current.findIndex((b) => b.id === selected)
      : -1;
    const nextIndex =
      index === -1
        ? delta === 1
          ? 0
          : current.length - 1
        : Math.min(current.length - 1, Math.max(0, index + delta));
    setSelectedId(current[nextIndex]?.id ?? null);
  }, []);

  const reorderBlocks = useCallback((dragId: string, targetId: string) => {
    if (dragId === targetId) return;
    setBlocks((prev) => {
      const from = prev.findIndex((b) => b.id === dragId);
      const to = prev.findIndex((b) => b.id === targetId);
      if (from === -1 || to === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      const editable = isEditableTarget(event.target);

      if (event.key === "?" && !editable && !meta && !event.altKey) {
        event.preventDefault();
        setShowShortcuts((open) => !open);
        return;
      }

      if (meta && event.key === "Enter") {
        event.preventDefault();
        addBlock("paragraph", selectedIdRef.current);
        return;
      }

      if (meta && event.key.toLowerCase() === "d") {
        if (!selectedIdRef.current) return;
        event.preventDefault();
        duplicateBlock(selectedIdRef.current);
        return;
      }

      if (meta && (event.key === "Backspace" || event.key === "Delete")) {
        // Avoid fighting text editors (Cmd+Backspace deletes a line on macOS).
        if (editable || !selectedIdRef.current) return;
        event.preventDefault();
        removeBlock(selectedIdRef.current);
        return;
      }

      if (editable || meta || event.altKey) return;

      if (event.key === "ArrowUp") {
        event.preventDefault();
        moveSelection(-1);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        moveSelection(1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [addBlock, duplicateBlock, removeBlock, moveSelection]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      if (projectId) {
        const res = await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, blocks }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(getApiErrorMessage(data, "Failed to save project"));
        }
      } else {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, blocks }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(getApiErrorMessage(data, "Failed to create project"));
        }
        if (data.id) router.push(`/builder/${data.id}`);
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [projectId, title, blocks, router]);

  const handleDelete = useCallback(async () => {
    if (!projectId) return;
    if (!window.confirm("Delete this project? This cannot be undone.")) return;

    setDeleting(true);
    setSaveError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(getApiErrorMessage(data, "Failed to delete project"));
      }
      router.push("/builder");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }, [projectId, router]);

  const handlePublishToggle = useCallback(async () => {
    if (!projectId) {
      setSaveError("Save the project before publishing a share link.");
      return;
    }

    setPublishing(true);
    setSaveError(null);
    setShareNotice(null);

    try {
      const nextPublic = !isPublic;
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          blocks,
          isPublic: nextPublic,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(getApiErrorMessage(data, "Failed to update share settings"));
      }

      setIsPublic(nextPublic);
      if (nextPublic) {
        const shareUrl = `${window.location.origin}/share/${projectId}`;
        await navigator.clipboard.writeText(shareUrl);
        setShareNotice(`Published. Share link copied: ${shareUrl}`);
      } else {
        setShareNotice("Project is now private.");
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to publish");
    } finally {
      setPublishing(false);
    }
  }, [projectId, isPublic, title, blocks]);

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
      <div className="flex items-center justify-between gap-3">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="max-w-md text-lg font-semibold border-transparent focus-visible:border-zinc-200"
        />
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowShortcuts((open) => !open)}
            aria-pressed={showShortcuts}
            title="Keyboard shortcuts"
          >
            <Keyboard className="h-3.5 w-3.5" strokeWidth={1.5} />
            Shortcuts
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigator.clipboard.writeText(blocksToMarkdown(blocks))}
          >
            <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />
            Copy MD
          </Button>
          {projectId && (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePublishToggle}
              disabled={publishing}
            >
              <Link2 className="h-3.5 w-3.5" strokeWidth={1.5} />
              {publishing
                ? "Updating..."
                : isPublic
                  ? "Unpublish"
                  : "Publish"}
            </Button>
          )}
          {projectId && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="h-3.5 w-3.5" strokeWidth={1.5} />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {showShortcuts && (
        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
          <p className="mb-2 font-medium text-zinc-900">Keyboard shortcuts</p>
          <ul className="space-y-1">
            {SHORTCUTS.map((item) => (
              <li key={item.keys} className="flex flex-wrap gap-2">
                <span className="font-mono text-xs text-zinc-500">
                  {item.keys}
                </span>
                <span>{item.action}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {shareNotice && (
        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
          {shareNotice}
        </div>
      )}

      {saveError && (
        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
          {saveError}
        </div>
      )}

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
                  type="button"
                  onClick={() => addBlock(bt.type)}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                >
                  <Icon className="h-4 w-4" strokeWidth={1.5} />
                  {bt.label}
                </button>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-zinc-400">
            Drag the grip to reorder. Press ? for shortcuts.
          </p>
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
              <div className="space-y-2">
                {blocks.map((block) => (
                  <div
                    key={block.id}
                    onClick={() => setSelectedId(block.id)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverId(block.id);
                    }}
                    onDragLeave={() => {
                      setDragOverId((current) =>
                        current === block.id ? null : current
                      );
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const dragId = e.dataTransfer.getData("text/block-id");
                      setDragOverId(null);
                      if (dragId) reorderBlocks(dragId, block.id);
                    }}
                    className={`flex cursor-pointer gap-2 rounded-md p-3 transition-colors ${
                      selectedId === block.id
                        ? "bg-zinc-50 ring-1 ring-zinc-200"
                        : "hover:bg-zinc-50"
                    } ${
                      dragOverId === block.id
                        ? "ring-1 ring-zinc-400"
                        : ""
                    }`}
                  >
                    <button
                      type="button"
                      draggable
                      aria-label="Drag to reorder"
                      title="Drag to reorder"
                      onClick={(e) => e.stopPropagation()}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/block-id", block.id);
                        e.dataTransfer.effectAllowed = "move";
                        setSelectedId(block.id);
                      }}
                      onDragEnd={() => setDragOverId(null)}
                      className="mt-0.5 flex h-6 w-6 shrink-0 cursor-grab items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 active:cursor-grabbing"
                    >
                      <GripVertical className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                    <div className="min-w-0 flex-1">
                      {block.type === "heading" && (
                        <h2 className="text-xl font-semibold">{block.content}</h2>
                      )}
                      {block.type === "paragraph" && (
                        <p className="text-sm text-zinc-600">{block.content}</p>
                      )}
                      {block.type === "image" && (
                        <div className="space-y-2">
                          {block.url && isAllowedContentImageUrl(block.url) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={block.url}
                              alt={block.content || "Content image"}
                              className="max-h-64 w-full rounded-md border border-zinc-200 object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="flex items-center gap-2 text-sm text-zinc-500">
                              <ImageIcon className="h-4 w-4" strokeWidth={1.5} />
                              {block.url
                                ? "Image URL is not on the allowlist"
                                : "No image URL"}
                            </div>
                          )}
                          {block.content && (
                            <p className="text-xs text-zinc-400">
                              {block.content}
                            </p>
                          )}
                        </div>
                      )}
                      {block.type === "divider" && (
                        <hr className="border-zinc-200" />
                      )}
                      {block.type === "cta" && (
                        <span className="inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm text-white">
                          {block.content}
                        </span>
                      )}
                    </div>
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
                  ref={contentFieldRef}
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
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => duplicateBlock(selectedBlock.id)}
                >
                  Duplicate Block
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => removeBlock(selectedBlock.id)}
                >
                  Remove Block
                </Button>
              </div>
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
