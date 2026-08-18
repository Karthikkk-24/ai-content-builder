"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, X } from "lucide-react";
import { uploadFiles } from "@/lib/uploadthing";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 4 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

type RecentReference = {
  id: string;
  url: string;
  fileName: string;
};

interface ReferenceImageUploaderProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  className?: string;
}

function parseListedReferences(data: unknown): RecentReference[] {
  if (
    !data ||
    typeof data !== "object" ||
    !("items" in data) ||
    !Array.isArray((data as { items: unknown }).items)
  ) {
    return [];
  }

  return (data as { items: unknown[] }).items.flatMap((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      typeof (item as { id?: unknown }).id !== "string" ||
      typeof (item as { url?: unknown }).url !== "string" ||
      typeof (item as { fileName?: unknown }).fileName !== "string"
    ) {
      return [];
    }
    const row = item as RecentReference;
    return [{ id: row.id, url: row.url, fileName: row.fileName }];
  });
}

export function ReferenceImageUploader({
  value,
  onChange,
  className,
}: ReferenceImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recents, setRecents] = useState<RecentReference[]>([]);

  const loadRecents = useCallback(async () => {
    try {
      const res = await fetch("/api/reference-images");
      if (!res.ok) return;
      const data: unknown = await res.json();
      setRecents(parseListedReferences(data));
    } catch {
      // Listing is best-effort; upload still works.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/reference-images");
        if (!res.ok || cancelled) return;
        const data: unknown = await res.json();
        if (!cancelled) setRecents(parseListedReferences(data));
      } catch {
        // Listing is best-effort; upload still works.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const processFile = useCallback(
    async (file: File) => {
      setError(null);

      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError("Please upload a PNG, JPG, or WebP image.");
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        setError("Image must be 4MB or smaller.");
        return;
      }

      setUploading(true);
      try {
        const result = await uploadFiles("referenceImage", {
          files: [file],
        });
        const uploaded = result?.[0];
        const url =
          uploaded?.serverData?.url ??
          uploaded?.ufsUrl ??
          null;

        if (!url) {
          throw new Error("Upload returned no URL");
        }

        onChange(url);
        void loadRecents();
      } catch {
        setError("Failed to upload image. Please try again.");
      } finally {
        setUploading(false);
      }
    },
    [loadRecents, onChange]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  if (value) {
    return (
      <div className={cn("relative", className)}>
        <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-zinc-200">
          <Image
            src={value}
            alt="Reference"
            fill
            className="object-cover"
            unoptimized={value.startsWith("data:")}
          />
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-zinc-200 bg-white hover:bg-zinc-50"
        >
          <X className="h-3 w-3" strokeWidth={1.5} />
        </button>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed bg-zinc-50 px-6 py-10 transition-colors",
          dragOver
            ? "border-zinc-900 bg-zinc-100"
            : "border-zinc-300 hover:border-zinc-400 hover:bg-zinc-100",
          uploading && "pointer-events-none opacity-60"
        )}
      >
        {uploading ? (
          <Loader2 className="h-8 w-8 animate-spin text-zinc-400" strokeWidth={1.5} />
        ) : (
          <ImagePlus className="h-8 w-8 text-zinc-300" strokeWidth={1.5} />
        )}
        <p className="mt-3 text-sm text-zinc-600">
          {uploading ? "Uploading image..." : "Drop a reference image or click to browse"}
        </p>
        <p className="mt-1 text-xs text-zinc-400">PNG, JPG, WebP up to 4MB</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileChange}
      />

      {error && <p className="text-xs text-zinc-600">{error}</p>}

      {recents.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-500">Recent uploads</p>
          <div className="grid grid-cols-4 gap-2">
            {recents.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onChange(item.url)}
                className="relative aspect-square overflow-hidden rounded-md border border-zinc-200 bg-zinc-50 hover:border-zinc-400"
                title={item.fileName}
              >
                <Image
                  src={item.url}
                  alt={item.fileName}
                  fill
                  className="object-cover"
                  unoptimized={item.url.startsWith("data:")}
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
