const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.82;
const MAX_OUTPUT_BYTES = 900_000;

export async function compressImageFile(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    const { width, height } = fitWithinBounds(
      image.naturalWidth,
      image.naturalHeight,
      MAX_DIMENSION
    );

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");

    ctx.drawImage(image, 0, 0, width, height);

    let quality = JPEG_QUALITY;
    let dataUrl = canvas.toDataURL("image/jpeg", quality);

    while (dataUrl.length > MAX_OUTPUT_BYTES && quality > 0.4) {
      quality -= 0.1;
      dataUrl = canvas.toDataURL("image/jpeg", quality);
    }

    if (dataUrl.length > MAX_OUTPUT_BYTES) {
      throw new Error("Image is too large after compression. Try a smaller file.");
    }

    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image"));
    image.src = src;
  });
}

function fitWithinBounds(
  width: number,
  height: number,
  maxDimension: number
): { width: number; height: number } {
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height };
  }

  const ratio = Math.min(maxDimension / width, maxDimension / height);
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  };
}

/**
 * Bound for persisted `data:image` URLs (generations + project image blocks).
 * Typical 1024² JPEG data URLs fit; larger rasters need Uploadthing.
 */
export const MAX_STORABLE_DATA_URL_LENGTH = 1_000_000;
export const GENERATED_IMAGE_PLACEHOLDER = "[generated-image]";

/** Query params that must never leave the server (provider API keys, tokens). */
const SECRET_QUERY_PARAMS = new Set([
  "key",
  "api_key",
  "apikey",
  "access_token",
  "token",
]);

/**
 * Strip provider secrets from a URL before returning it to clients or storing it.
 * Non-URL strings (e.g. data URLs, plain text) are returned unchanged.
 */
export function scrubProviderSecretsFromUrl(value: string): string {
  if (!value || value.startsWith("data:")) {
    return value;
  }

  try {
    const url = new URL(value);
    let changed = false;
    for (const param of [...url.searchParams.keys()]) {
      if (SECRET_QUERY_PARAMS.has(param.toLowerCase())) {
        url.searchParams.delete(param);
        changed = true;
      }
    }
    return changed ? url.toString() : value;
  } catch {
    // Not a parseable absolute URL — strip common key= patterns defensively.
    return value.replace(
      /([?&])(key|api_key|apikey|access_token|token)=([^&#]*)/gi,
      "$1"
    ).replace(/[?&]$/, "");
  }
}

export function sanitizeReferenceImageForStorage(url: string | null | undefined) {
  if (!url || url.startsWith("data:")) {
    return null;
  }

  return scrubProviderSecretsFromUrl(url);
}

export function sanitizeGeneratedOutputForStorage(content: string) {
  const scrubbed = scrubProviderSecretsFromUrl(content);

  if (
    scrubbed.startsWith("data:image/") &&
    scrubbed.length > MAX_STORABLE_DATA_URL_LENGTH
  ) {
    return GENERATED_IMAGE_PLACEHOLDER;
  }

  return scrubbed;
}

/** History / View: https(s) or raster data:image, not the oversize sentinel. */
export function isViewableGeneratedImageUrl(value: string): boolean {
  if (!value || value === GENERATED_IMAGE_PLACEHOLDER) return false;
  if (value.startsWith("https://") || value.startsWith("http://")) return true;
  return /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(value);
}
