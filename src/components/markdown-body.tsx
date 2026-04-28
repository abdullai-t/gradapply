"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

type Props = {
  content: string;
  /// Override the wrapper class — defaults to chat-bubble density.
  className?: string;
};

const markdownComponents = {
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      {...props}
      target="_blank"
      rel="noopener noreferrer"
      className="font-bold text-[var(--primary)] underline-offset-4 hover:underline"
    />
  ),
};

const remarkPlugins = [remarkGfm];

/**
 * Shared GitHub-flavored markdown renderer for any LLM-generated prose
 * surface. Keep all prose render sites going through this so headings,
 * lists, bold, code, tables, and links look consistent.
 *
 * Visual styling lives in `globals.css` under `.sop-markdown` (the class
 * name predates this extraction; kept for backwards compatibility — every
 * surface that imports MarkdownBody picks up the same look).
 *
 * Memoized: ReactMarkdown reparses the entire string on every render, so
 * during streaming we'd otherwise re-parse the full message on every token
 * batch — even for sibling messages that didn't change. memo skips the work
 * when content/className are referentially equal to the previous render.
 */
export const MarkdownBody = memo(function MarkdownBody({
  content,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "sop-markdown text-[15px] leading-relaxed text-[var(--on-surface)]",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
