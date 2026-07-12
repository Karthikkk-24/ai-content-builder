"use client";

import { useState } from "react";
import Image from "next/image";
import { ImagePlus, X } from "lucide-react";
import { UploadDropzone } from "@/lib/uploadthing";
import { cn } from "@/lib/utils";

interface ReferenceImageUploaderProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  className?: string;
}

export function ReferenceImageUploader({
  value,
  onChange,
  className,
}: ReferenceImageUploaderProps) {
  const [uploading, setUploading] = useState(false);

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
          onClick={() => onChange(null)}
          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-zinc-200 bg-white hover:bg-zinc-50"
        >
          <X className="h-3 w-3" strokeWidth={1.5} />
        </button>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <UploadDropzone
        endpoint="referenceImage"
        onClientUploadComplete={(res) => {
          if (res?.[0]?.url) {
            onChange(res[0].url);
          }
          setUploading(false);
        }}
        onUploadError={() => setUploading(false)}
        onUploadBegin={() => setUploading(true)}
        appearance={{
          container: "border border-dashed border-zinc-300 rounded-lg bg-zinc-50 ut-uploading:bg-zinc-100",
          label: "text-zinc-600 text-sm",
          allowedContent: "text-zinc-400 text-xs",
        }}
        content={{
          label: uploading ? "Uploading..." : "Drop a reference image or click to browse",
          allowedContent: "PNG, JPG up to 4MB",
        }}
      />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        {!uploading && (
          <ImagePlus className="h-8 w-8 text-zinc-300" strokeWidth={1.5} />
        )}
      </div>
    </div>
  );
}
