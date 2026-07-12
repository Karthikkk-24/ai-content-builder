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

export function sanitizeReferenceImageForStorage(url: string | null | undefined) {
  if (!url || url.startsWith("data:")) {
    return null;
  }

  return url;
}

export function sanitizeGeneratedOutputForStorage(content: string) {
  if (content.startsWith("data:image/") && content.length > 100_000) {
    return "[generated-image]";
  }

  return content;
}
