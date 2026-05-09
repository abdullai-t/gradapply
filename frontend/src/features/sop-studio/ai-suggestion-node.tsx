"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { useState } from "react";

import { Icon } from "@/components/icon";

/**
 * Window event fired when the user resolves a suggestion via its inline
 * toolbar. Editor-level UI (the post-accept Undo toast) listens for this.
 * Reject does NOT fire — rejecting restores the original text, so there's
 * nothing to recover.
 */
export const SUGGESTION_RESOLVED_EVENT = "sop:suggestion-resolved";

export type SuggestionResolvedDetail = {
  state: "accepted";
  oldText: string;
  newText: string;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    aiSuggestion: {
      /**
       * Replaces the current selection with a pending AI suggestion node.
       * The node renders both old (strikethrough) and new (green) text
       * with an inline accept/reject toolbar. Until the user resolves it,
       * the original prose is preserved as the node's content; the new
       * text lives in attrs.
       */
      insertAiSuggestion: (input: {
        oldText: string;
        newText: string;
        prompt: string;
      }) => ReturnType;
      /** Resolve a suggestion: keep newText, drop the wrapper. */
      acceptAiSuggestion: (id: string) => ReturnType;
      /** Resolve a suggestion: keep oldText, drop the wrapper. */
      rejectAiSuggestion: (id: string) => ReturnType;
    };
  }
}

/**
 * Inline Tiptap node representing a pending AI rewrite over the user's
 * current selection. Atom-style: not directly editable. Resolved by the
 * inline toolbar inside the NodeView (or by external commands).
 *
 * v1 supports inline single-paragraph selections only. Multi-paragraph
 * selections are rejected upstream in the BubbleMenu.
 */
export const AiSuggestion = Node.create({
  name: "aiSuggestion",
  group: "inline",
  inline: true,
  atom: true,
  selectable: false,
  draggable: false,

  addAttributes() {
    return {
      id: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-suggestion-id") ?? "",
        renderHTML: (attrs) => ({
          "data-suggestion-id": attrs.id,
        }),
      },
      oldText: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-old") ?? "",
        renderHTML: (attrs) => ({ "data-old": attrs.oldText }),
      },
      newText: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-new") ?? "",
        renderHTML: (attrs) => ({ "data-new": attrs.newText }),
      },
      prompt: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-prompt") ?? "",
        renderHTML: (attrs) => ({ "data-prompt": attrs.prompt }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-ai-suggestion]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-ai-suggestion": "" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SuggestionView);
  },

  addCommands() {
    return {
      insertAiSuggestion:
        (input) =>
        ({ chain, state }) => {
          const { from, to } = state.selection;
          if (from === to) return false;
          const id =
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `sg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          return chain()
            .focus()
            .insertContentAt(
              { from, to },
              {
                type: "aiSuggestion",
                attrs: {
                  id,
                  oldText: input.oldText,
                  newText: input.newText,
                  prompt: input.prompt,
                },
              },
            )
            .run();
        },
      acceptAiSuggestion:
        (id) =>
        ({ tr, state, dispatch }) => {
          const range = findSuggestionRange(state, id);
          if (!range) return false;
          if (dispatch) {
            tr.replaceWith(
              range.from,
              range.to,
              state.schema.text(range.node.attrs.newText),
            );
            dispatch(tr);
          }
          return true;
        },
      rejectAiSuggestion:
        (id) =>
        ({ tr, state, dispatch }) => {
          const range = findSuggestionRange(state, id);
          if (!range) return false;
          if (dispatch) {
            const old = String(range.node.attrs.oldText ?? "");
            if (old.length > 0) {
              tr.replaceWith(range.from, range.to, state.schema.text(old));
            } else {
              tr.delete(range.from, range.to);
            }
            dispatch(tr);
          }
          return true;
        },
    };
  },
});

function findSuggestionRange(
  state: import("@tiptap/pm/state").EditorState,
  id: string,
): { from: number; to: number; node: import("@tiptap/pm/model").Node } | null {
  let result: { from: number; to: number; node: import("@tiptap/pm/model").Node } | null = null;
  state.doc.descendants((node, pos) => {
    if (result) return false;
    if (node.type.name === "aiSuggestion" && node.attrs.id === id) {
      result = { from: pos, to: pos + node.nodeSize, node };
      return false;
    }
    return true;
  });
  return result;
}

/**
 * The visible side of a pending suggestion. Renders three things:
 *   - the original text struck through (so the user can compare),
 *   - the proposed text in a green pill,
 *   - an inline toolbar (✓ Accept · ✕ Reject) anchored to the suggestion.
 *
 * "Try again" is intentionally omitted in v1 — the user can reject and
 * re-prompt manually, which keeps the NodeView surface simple and avoids
 * embedding another input + LLM call inside the node.
 */
function SuggestionView({ node, editor }: NodeViewProps) {
  const [hovered, setHovered] = useState(false);
  const id = String(node.attrs.id ?? "");
  const oldText = String(node.attrs.oldText ?? "");
  const newText = String(node.attrs.newText ?? "");

  return (
    <NodeViewWrapper
      as="span"
      className="ai-suggestion"
      data-suggestion-id={id}
      contentEditable={false}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="ai-suggestion__old" aria-label="Original text">
        {oldText}
      </span>
      <span className="ai-suggestion__new" aria-label="AI suggestion">
        {newText}
      </span>
      <span
        className={`ai-suggestion__toolbar ${hovered ? "is-hovered" : ""}`}
        contentEditable={false}
      >
        <button
          type="button"
          aria-label="Accept suggestion"
          title="Accept"
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().acceptAiSuggestion(id).run();
            window.dispatchEvent(
              new CustomEvent(SUGGESTION_RESOLVED_EVENT, {
                detail: { state: "accepted", oldText, newText },
              }),
            );
          }}
          className="ai-suggestion__btn ai-suggestion__btn--accept"
        >
          <Icon name="check" size={14} fill />
        </button>
        <button
          type="button"
          aria-label="Reject suggestion"
          title="Reject"
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().rejectAiSuggestion(id).run();
          }}
          className="ai-suggestion__btn ai-suggestion__btn--reject"
        >
          <Icon name="close" size={14} />
        </button>
      </span>
    </NodeViewWrapper>
  );
}
