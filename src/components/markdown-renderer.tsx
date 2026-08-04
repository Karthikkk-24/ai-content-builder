"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
  content: string;
}

/**
 * Renders AI-generated text as safely-parsed Markdown.
 * Supported: headings, bold/italic, lists, links, code, blockquotes.
 * Blocked: HTML blocks, JavaScript URLs, footnotes, raw HTML.
 */
export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-zinc prose-sm max-w-none rounded-md bg-zinc-50 p-4 text-zinc-900 prose-headings:font-semibold prose-a:text-zinc-700 prose-a:underline prose-code:bg-zinc-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-zinc-900 prose-pre:text-zinc-100">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
