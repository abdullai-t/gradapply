"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

type Props = {
  content: string;
  /// Override the wrapper class — defaults to chat-bubble density.
  className?: string;
};

/**
 * Shared GitHub-flavored markdown renderer for any LLM-generated prose
 * surface. Keep all prose render sites going through this so headings,
 * lists, bold, code, tables, and links look consistent.
 *
 * Visual styling lives in `globals.css` under `.sop-markdown` (the class
 * name predates this extraction; kept for backwards compatibility — every
 * surface that imports MarkdownBody picks up the same look).
 */
export function MarkdownBody({ content, className }: Props) {
  return (
    <div
      className={cn(
        "sop-markdown text-[15px] leading-relaxed text-[var(--on-surface)]",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: (props) => (
            <a
              {...props}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-[var(--primary)] underline-offset-4 hover:underline"
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
