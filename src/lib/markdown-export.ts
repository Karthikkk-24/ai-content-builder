import type { ContentBlock } from "@/lib/db/schema";
import { isAllowedDataImageUrl } from "@/lib/safe-url";

const HTML_TAG_REGEX = /<\/?[a-z][\s\S]*?>/gi;

/**
 * Sanitize block text before Markdown export or persistence so AI/user
 * content cannot inject headings, raw HTML, or break out of link/image syntax.
 */
export function sanitizeBlockContentForMarkdown(
  content: string,
  blockType: ContentBlock["type"] | "plain" = "plain"
): string {
  if (typeof content !== "string" || !content) return "";

  let text = content.normalize("NFC").replace(/\u0000/g, "");
  text = text.replace(HTML_TAG_REGEX, "");

  if (blockType === "paragraph" || blockType === "plain") {
    text = text
      .split("\n")
      .map((line) => {
        // Neutralize ATX headings / setext-ish thematic breaks inside paragraphs.
        if (/^#{1,6}\s+/.test(line)) {
          return line.replace(/^(#{1,6})\s+/, "$1\\ ");
        }
        if (/^(-{3,}|_{3,}|\*{3,})\s*$/.test(line.trim())) {
          return `\\${line.trim()}`;
        }
        return line;
      })
      .join("\n");
  }

  return text.trim();
}

function escapeLinkText(text: string): string {
  return text.replace(/[\[\]]/g, "\\$&");
}

function sanitizeMarkdownUrl(
  url: string | undefined,
  options: { allowRasterData?: boolean } = {}
): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (/^(javascript|vbscript):/i.test(trimmed)) {
    return "";
  }
  if (/^data:/i.test(trimmed)) {
    if (options.allowRasterData && isAllowedDataImageUrl(trimmed)) {
      return trimmed;
    }
    return "";
  }
  // Escape parentheses that would break markdown link/image destinations.
  return trimmed.replace(/[()]/g, encodeURIComponent);
}

/** Client renderer: keep raster data:image; drop javascript / other data:. */
export function transformMarkdownRendererUrl(url: string): string {
  const trimmed = url.trim();
  if (/^(javascript|vbscript):/i.test(trimmed)) {
    return "";
  }
  if (/^data:/i.test(trimmed)) {
    return isAllowedDataImageUrl(trimmed) ? trimmed : "";
  }
  return trimmed;
}

export function blocksToMarkdown(blocks: ContentBlock[]): string {
  return blocks
    .map((block) => {
      const content = sanitizeBlockContentForMarkdown(
        block.content,
        block.type
      );
      switch (block.type) {
        case "heading": {
          const level = Math.min(6, Math.max(1, block.level || 1));
          return `${"#".repeat(level)} ${content}\n`;
        }
        case "paragraph":
          return `${content}\n\n`;
        case "image": {
          const alt = escapeLinkText(content || "image");
          const src = sanitizeMarkdownUrl(block.url, { allowRasterData: true });
          return src ? `![${alt}](${src})\n\n` : "";
        }
        case "divider":
          return "---\n\n";
        case "cta": {
          const label = escapeLinkText(content || "Link");
          const href = sanitizeMarkdownUrl(block.url) || "#";
          return `[${label}](${href})\n\n`;
        }
        default:
          return "";
      }
    })
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd()
    .concat("\n");
}
