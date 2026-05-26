"use client";

import { useEditor, EditorContent, BubbleMenu, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import { Icon } from "@/components/icon";

import { applyRewriteInRange } from "./apply-rewrite";
import { AiSuggestion } from "./ai-suggestion-node";

export type SopEditorHandle = {
  /** Replace the entire document with new HTML (used when AI rewrites). */
  setHtml: (html: string) => void;
  /** Get the current HTML — used on save. */
  getHtml: () => string;
  /** Get the plain text representation — used to score the SOP. */
  getText: () => string;
  /** Focus the editor surface. */
  focus: () => void;
  /** Undo the last transaction. Used by the post-accept Undo toast. */
  undo: () => void;
};

type Props = {
  initialHtml: string;
  /** Called on every transaction that mutates the document. */
  onChange?: (html: string, text: string) => void;
  /** Optional placeholder when the doc is empty. */
  placeholder?: string;
  /** Brief flash highlight (e.g. after an AI rewrite lands). */
  flash?: boolean;
  /**
   * Network function for the BubbleMenu's "Ask AI" rewrite. The parent
   * supplies it (it knows schoolId, billing, etc.) but the editor owns
   * the apply step so the selection range stays valid across the await.
   */
  onRewriteSelection?: (input: {
    selectionText: string;
    prompt: string;
  }) => Promise<{ newText: string; unchanged: boolean }>;
  /** Rewrite the whole paragraph under the cursor (collapsed selection). */
  onRewriteParagraph?: (input: {
    selectionText: string;
    prompt: string;
  }) => Promise<{ newText: string; unchanged: boolean }>;
  /** Fired after a selection/paragraph rewrite is applied directly in the doc. */
  onDirectRewriteApplied?: (meta: {
    description: string;
    undo: () => void;
  }) => void;
};

/**
 * Tiptap-backed rich-text surface for the tailored SOP variant.
 *
 * Includes the AI-suggestion extension (inline strike+green diff with an
 * accept/reject toolbar) and a BubbleMenu that surfaces an "Ask AI" chip
 * whenever the user has a non-empty selection.
 */
export const SopTiptapEditor = forwardRef<SopEditorHandle, Props>(
  function SopTiptapEditor(
    {
      initialHtml,
      onChange,
      placeholder,
      flash,
      onRewriteSelection,
      onRewriteParagraph,
      onDirectRewriteApplied,
    },
    ref,
  ) {
    const editor = useEditor({
      extensions: [
        StarterKit,
        Placeholder.configure({
          placeholder: placeholder ?? "Your tailored statement of purpose…",
          emptyEditorClass: "is-editor-empty",
        }),
        AiSuggestion,
      ],
      content: initialHtml || "",
      immediatelyRender: false,
      editorProps: {
        attributes: {
          class: "prose-doc focus:outline-none min-h-[480px]",
        },
      },
      onUpdate: ({ editor }) => {
        onChange?.(editor.getHTML(), editor.getText());
      },
    });

    useImperativeHandle(
      ref,
      () => ({
        setHtml: (html) => {
          if (!editor) return;
          if (editor.getHTML() !== html) {
            editor.commands.setContent(html, false);
          }
        },
        getHtml: () => editor?.getHTML() ?? "",
        getText: () => editor?.getText() ?? "",
        focus: () => editor?.commands.focus(),
        undo: () => {
          editor?.chain().focus().undo().run();
        },
      }),
      [editor],
    );

    // Reset content if `initialHtml` changes externally and differs from the
    // editor's current state (e.g. variant loaded from server).
    useEffect(() => {
      if (!editor) return;
      if (initialHtml && editor.getHTML() !== initialHtml) {
        editor.commands.setContent(initialHtml, false);
      }
    }, [editor, initialHtml]);

    return (
      <div className={`flex flex-col ${flash ? "sop-rewrite-flash" : ""}`}>
        {editor ? <Toolbar editor={editor} /> : null}
        <div className="px-10 py-8">
          <EditorContent editor={editor} />
        </div>
        {editor && onRewriteSelection ? (
          <SelectionBubble
            editor={editor}
            onRewrite={onRewriteSelection}
            onApplied={onDirectRewriteApplied}
          />
        ) : null}
        {editor && onRewriteParagraph ? (
          <ParagraphBubble
            editor={editor}
            onRewrite={onRewriteParagraph}
            onApplied={onDirectRewriteApplied}
          />
        ) : null}
      </div>
    );
  },
);

function getActiveParagraph(editor: Editor): {
  from: number;
  to: number;
  text: string;
} | null {
  const { $from } = editor.state.selection;
  if ($from.parent.type.name !== "paragraph") return null;
  const from = $from.start();
  const to = $from.end();
  const text = editor.state.doc.textBetween(from, to, "\n");
  if (text.trim().length < 12) return null;
  return { from, to, text };
}

/* ============ BubbleMenu — "Ask AI" on selection ============ */

function SelectionBubble({
  editor,
  onRewrite,
  onApplied,
}: {
  editor: Editor;
  onRewrite: (input: {
    selectionText: string;
    prompt: string;
  }) => Promise<{ newText: string; unchanged: boolean }>;
  onApplied?: (meta: { description: string; undo: () => void }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset whenever the underlying selection collapses, unless the user is
  // typing in the prompt input (we don't want focus changes to steal the
  // popover from under them).
  useEffect(() => {
    const handler = () => {
      if (
        document.activeElement !== inputRef.current &&
        editor.state.selection.from === editor.state.selection.to
      ) {
        setOpen(false);
        setPrompt("");
        setError(null);
      }
    };
    editor.on("selectionUpdate", handler);
    return () => {
      editor.off("selectionUpdate", handler);
    };
  }, [editor]);

  const submit = async () => {
    const text = prompt.trim();
    if (!text || busy) return;
    // Snapshot the selection BEFORE the network round trip — focus may
    // shift during the await and the doc may even update.
    const { from, to } = editor.state.selection;
    if (from === to) {
      setError("Select some text first.");
      return;
    }
    const selectionText = editor.state.doc.textBetween(from, to, "\n");
    if (!selectionText.trim()) {
      setError("Selection is empty.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await onRewrite({ selectionText, prompt: text });
      if (result.unchanged) {
        setError(
          "AI returned the same text — try a more specific instruction.",
        );
        return;
      }
      const previousHtml = editor.getHTML();
      editor.chain().focus().setTextSelection({ from, to }).run();
      applyRewriteInRange(editor, from, to, result.newText);
      onApplied?.({
        description: "Selection updated",
        undo: () => {
          editor.commands.setContent(previousHtml, false);
        },
      });
      setOpen(false);
      setPrompt("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rewrite failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{
        duration: 120,
        placement: "top",
        // Re-position automatically when the prompt expands.
        popperOptions: { modifiers: [{ name: "flip", enabled: true }] },
      }}
      shouldShow={({ editor, from, to }) => {
        // Only show for non-empty selections (≥4 chars to avoid noise on
        // single-character clicks/drags). Hide when the selection sits
        // inside a suggestion node (resolve that one first).
        if (from === to) return false;
        const text = editor.state.doc.textBetween(from, to, "\n");
        if (text.trim().length < 4) return false;
        let insideSuggestion = false;
        editor.state.doc.nodesBetween(from, to, (n) => {
          if (n.type.name === "aiSuggestion") insideSuggestion = true;
        });
        if (insideSuggestion) return false;
        return true;
      }}
    >
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            // Defer focus until input mounts.
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-white shadow-md transition-all hover:scale-[1.03]"
          style={{
            background:
              "linear-gradient(135deg, var(--primary), var(--primary-fixed-dim))",
          }}
        >
          <Icon name="auto_awesome" fill size={14} />
          Ask AI
        </button>
      ) : (
        <div className="flex w-[340px] flex-col gap-1.5 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-2 shadow-xl">
          <div className="flex items-center gap-1.5 rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-2.5 py-1.5">
            <Icon
              name="auto_fix_high"
              size={16}
              className="shrink-0 text-[var(--primary)]"
            />
            <input
              ref={inputRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submit();
                } else if (e.key === "Escape") {
                  setOpen(false);
                  setPrompt("");
                  setError(null);
                }
              }}
              placeholder="Tighten this · make it punchier · add specifics…"
              disabled={busy}
              className="flex-1 border-0 bg-transparent text-[13px] outline-none placeholder:text-[var(--outline)]"
            />
            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy || !prompt.trim()}
              aria-label="Send rewrite request"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-white disabled:opacity-40"
              style={{
                background:
                  "linear-gradient(135deg, var(--primary), var(--primary-fixed-dim))",
              }}
            >
              {busy ? (
                <Icon name="progress_activity" size={14} className="animate-spin" />
              ) : (
                <Icon name="send" fill size={14} />
              )}
            </button>
          </div>
          {error ? (
            <div className="px-2 text-[11px] font-bold text-[var(--error)]">
              {error}
            </div>
          ) : (
            <div className="px-2 text-[11px] text-[var(--outline)]">
              Enter to replace selection · Esc to cancel
            </div>
          )}
        </div>
      )}
    </BubbleMenu>
  );
}

/* ============ BubbleMenu — whole paragraph when cursor is inside ============ */

function ParagraphBubble({
  editor,
  onRewrite,
  onApplied,
}: {
  editor: Editor;
  onRewrite: (input: {
    selectionText: string;
    prompt: string;
  }) => Promise<{ newText: string; unchanged: boolean }>;
  onApplied?: (meta: { description: string; undo: () => void }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    const instruction = prompt.trim();
    if (!instruction || busy) return;
    const para = getActiveParagraph(editor);
    if (!para) {
      setError("Place the cursor inside a paragraph first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await onRewrite({
        selectionText: para.text,
        prompt: instruction,
      });
      if (result.unchanged) {
        setError(
          "AI returned the same text — try a more specific instruction.",
        );
        return;
      }
      const previousHtml = editor.getHTML();
      const { from, to } = para;
      editor.chain().focus().setTextSelection({ from, to }).run();
      applyRewriteInRange(editor, from, to, result.newText);
      onApplied?.({
        description: "Paragraph updated",
        undo: () => {
          editor.commands.setContent(previousHtml, false);
        },
      });
      setOpen(false);
      setPrompt("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rewrite failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{ duration: 120, placement: "top-start" }}
      shouldShow={({ editor, from, to }) => {
        if (from !== to) return false;
        const para = getActiveParagraph(editor);
        if (!para) return false;
        let insideSuggestion = false;
        editor.state.doc.nodesBetween(para.from, para.to, (n) => {
          if (n.type.name === "aiSuggestion") insideSuggestion = true;
        });
        return !insideSuggestion;
      }}
    >
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-1.5 text-xs font-bold text-[var(--on-surface)] shadow-md hover:border-[var(--primary)]"
        >
          <Icon name="auto_awesome" size={14} className="text-[var(--primary)]" />
          Improve paragraph
        </button>
      ) : (
        <div className="flex w-[340px] flex-col gap-1.5 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-2 shadow-xl">
          <div className="flex items-center gap-1.5 rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-2.5 py-1.5">
            <Icon
              name="auto_fix_high"
              size={16}
              className="shrink-0 text-[var(--primary)]"
            />
            <input
              ref={inputRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submit();
                } else if (e.key === "Escape") {
                  setOpen(false);
                  setPrompt("");
                  setError(null);
                }
              }}
              placeholder="Make this paragraph more specific…"
              disabled={busy}
              className="flex-1 border-0 bg-transparent text-[13px] outline-none placeholder:text-[var(--outline)]"
            />
            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy || !prompt.trim()}
              aria-label="Send paragraph rewrite"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-white disabled:opacity-40"
              style={{
                background:
                  "linear-gradient(135deg, var(--primary), var(--primary-fixed-dim))",
              }}
            >
              {busy ? (
                <Icon name="progress_activity" size={14} className="animate-spin" />
              ) : (
                <Icon name="send" fill size={14} />
              )}
            </button>
          </div>
          {error ? (
            <div className="px-2 text-[11px] font-bold text-[var(--error)]">
              {error}
            </div>
          ) : (
            <div className="px-2 text-[11px] text-[var(--outline)]">
              Enter to replace this paragraph · Esc to cancel
            </div>
          )}
        </div>
      )}
    </BubbleMenu>
  );
}

/* ============ Top toolbar (existing) ============ */

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex items-center gap-0.5 border-b border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-3 py-2">
      <ToolbarBtn
        icon="format_bold"
        label="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarBtn
        icon="format_italic"
        label="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarBtn
        icon="format_list_bulleted"
        label="Bulleted list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarBtn
        icon="format_list_numbered"
        label="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <span className="mx-1 h-5 w-px bg-[var(--outline-variant)]" />
      <ToolbarBtn
        icon="title"
        label="Heading"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        }
      />
      <ToolbarBtn
        icon="format_quote"
        label="Quote"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <span className="mx-1 h-5 w-px bg-[var(--outline-variant)]" />
      <ToolbarBtn
        icon="undo"
        label="Undo"
        onClick={() => editor.chain().focus().undo().run()}
      />
      <ToolbarBtn
        icon="redo"
        label="Redo"
        onClick={() => editor.chain().focus().redo().run()}
      />
    </div>
  );
}

function ToolbarBtn({
  icon,
  label,
  active,
  onClick,
}: {
  icon: string;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active ?? undefined}
      onClick={onClick}
      className={`grid h-8 w-8 place-items-center rounded-lg transition-colors ${
        active
          ? "bg-[var(--primary-container)] text-[var(--on-primary-container)]"
          : "text-[var(--outline)] hover:bg-[var(--surface-container)] hover:text-[var(--on-surface)]"
      }`}
    >
      <Icon name={icon} size={18} />
    </button>
  );
}
