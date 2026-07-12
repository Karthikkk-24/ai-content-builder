"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { compressImageFile } from "@/lib/image-utils";

const MAX_FILE_SIZE = 4 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

interface ReferenceImageUploaderProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  className?: string;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return compressImageFile(file);
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
        const dataUrl = await readFileAsDataUrl(file);
        onChange(dataUrl);
      } catch {
        setError("Failed to process image. Please try again.");
      } finally {
        setUploading(false);
      }
    },
    [onChange]
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
            unoptimized
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
          {uploading ? "Processing image..." : "Drop a reference image or click to browse"}
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
    </div>
  );
}
