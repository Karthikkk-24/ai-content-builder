"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

interface MarkdownRendererProps {
  content: string;
}

/** Tight schema: no raw HTML tags beyond what GFM needs via markdown AST. */
const markdownSanitizeSchema = {
  ...defaultSchema,
  protocols: {
    ...defaultSchema.protocols,
    href: ["http", "https", "mailto"],
  },
  attributes: {
    ...defaultSchema.attributes,
    a: [...(defaultSchema.attributes?.a || []), ["target"], ["rel"]],
    code: [...(defaultSchema.attributes?.code || []), ["className"]],
  },
};

/**
 * Renders AI-generated text as sanitized Markdown.
 * Supported: headings, bold/italic, lists, links, code, blockquotes, tables.
 * Blocked: raw HTML, javascript:/data: URLs (via rehype-sanitize).
 */
export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-zinc prose-sm max-w-none rounded-md bg-zinc-50 p-4 text-zinc-900 prose-headings:font-semibold prose-a:text-zinc-700 prose-a:underline prose-code:bg-zinc-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-zinc-900 prose-pre:text-zinc-100">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, markdownSanitizeSchema]]}
        urlTransform={(url) => {
          const trimmed = url.trim();
          if (/^(javascript|vbscript|data):/i.test(trimmed)) {
            return "";
          }
          return trimmed;
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
