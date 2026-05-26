import type { Editor } from "@tiptap/react";

import { paragraphsToHtml, splitParagraphs } from "@/lib/sop-paragraphs";

/**
 * Replace editor content between `from` and `to` with rewritten plain text.
 * Preserves paragraph structure when the rewrite contains multiple blocks.
 */
export function applyRewriteInRange(
  editor: Editor,
  from: number,
  to: number,
  newText: string,
): void {
  const trimmed = newText.trim();
  if (!trimmed) return;

  const { doc } = editor.state;
  const $from = doc.resolve(from);
  const $to = doc.resolve(to);
  const sameParent =
    $from.parent === $to.parent && $from.parent.type.name === "paragraph";
  const singleLine = !/\n{2,}/.test(trimmed) && !trimmed.includes("\n\n");

  if (sameParent && singleLine) {
    editor.chain().focus().insertContentAt({ from, to }, trimmed).run();
    return;
  }

  const html = paragraphsToHtml(splitParagraphs(trimmed));
  editor.chain().focus().deleteRange({ from, to }).insertContentAt(from, html).run();
}
