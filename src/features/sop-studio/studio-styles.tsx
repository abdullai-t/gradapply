"use client";

const STUDIO_CSS = `
      @keyframes sop-avatar-pulse {
        0%,
        100% {
          box-shadow: 0 8px 20px -6px rgba(0, 98, 157, 0.45),
            0 0 0 0 rgba(0, 98, 157, 0.35);
        }
        50% {
          box-shadow: 0 8px 20px -6px rgba(0, 98, 157, 0.45),
            0 0 0 10px rgba(0, 98, 157, 0);
        }
      }
      .sop-avatar-pulse {
        animation: sop-avatar-pulse 2.4s ease-in-out infinite;
      }
      @keyframes sop-rewrite-flash {
        0% {
          box-shadow: inset 0 0 0 0 rgba(0, 98, 157, 0);
        }
        30% {
          box-shadow: inset 0 0 0 3px rgba(0, 98, 157, 0.25);
        }
        100% {
          box-shadow: inset 0 0 0 0 rgba(0, 98, 157, 0);
        }
      }
      .sop-rewrite-flash {
        animation: sop-rewrite-flash 900ms ease-out;
      }
      .sop-thinking-dots .dot {
        display: inline-block;
        width: 4px;
        height: 4px;
        border-radius: 999px;
        background: var(--primary);
        animation: sop-dot 1s ease-in-out infinite;
      }
      .sop-thinking-dots .dot:nth-child(2) {
        animation-delay: 150ms;
      }
      .sop-thinking-dots .dot:nth-child(3) {
        animation-delay: 300ms;
      }
      @keyframes sop-dot {
        0%,
        100% {
          opacity: 0.3;
          transform: translateY(0);
        }
        50% {
          opacity: 1;
          transform: translateY(-2px);
        }
      }
      .prose-doc {
        color: var(--on-surface);
        line-height: 1.7;
        font-size: 15px;
      }
      .prose-doc h1,
      .prose-doc h2,
      .prose-doc h3 {
        font-weight: 800;
        line-height: 1.3;
        color: var(--on-surface);
      }
      .prose-doc h1 {
        font-size: 26px;
        margin: 0 0 1rem 0;
      }
      .prose-doc h2 {
        font-size: 22px;
        margin: 0 0 0.85rem 0;
      }
      .prose-doc h3 {
        font-size: 18px;
        margin: 0 0 0.7rem 0;
      }
      .prose-doc p {
        margin: 0 0 1.1rem 0;
      }
      .prose-doc em {
        background: color-mix(in srgb, var(--primary) 15%, transparent);
        font-style: normal;
        padding: 0 4px;
        border-radius: 4px;
        color: var(--primary);
      }
      .prose-doc ul,
      .prose-doc ol {
        margin: 0 0 1.1rem 1.4rem;
      }
      .prose-doc li {
        margin: 0 0 0.4rem 0;
      }
      .prose-doc blockquote {
        margin: 0 0 1.1rem 0;
        padding: 0.4rem 0 0.4rem 1rem;
        border-left: 3px solid color-mix(in srgb, var(--primary) 50%, transparent);
        color: var(--on-surface-variant);
      }
      .prose-doc.is-editor-empty:first-child::before {
        content: attr(data-placeholder);
        float: left;
        color: var(--outline);
        pointer-events: none;
        height: 0;
      }
      .prose-doc p.is-editor-empty:first-child::before {
        content: attr(data-placeholder);
        float: left;
        color: var(--outline);
        pointer-events: none;
        height: 0;
      }
      .ai-suggestion {
        display: inline;
        position: relative;
        white-space: normal;
        line-height: inherit;
      }
      .ai-suggestion__old {
        background: rgba(244, 67, 54, 0.12);
        color: #b3261e;
        text-decoration: line-through;
        text-decoration-color: rgba(179, 38, 30, 0.55);
        padding: 1px 4px;
        border-radius: 4px;
        margin-right: 6px;
      }
      .ai-suggestion__new {
        background: rgba(26, 163, 126, 0.16);
        color: #0f6e57;
        padding: 1px 4px;
        border-radius: 4px;
        font-weight: 500;
        animation: ai-suggestion-fade-in 240ms ease-out both;
      }
      .ai-suggestion__toolbar {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        margin-left: 6px;
        padding: 2px;
        border-radius: 999px;
        background: var(--surface-container-lowest);
        border: 1px solid var(--outline-variant);
        box-shadow: 0 4px 12px -4px rgba(15, 23, 42, 0.18);
        vertical-align: middle;
        opacity: 0.85;
        transition: opacity 160ms ease;
      }
      .ai-suggestion__toolbar.is-hovered,
      .ai-suggestion:hover .ai-suggestion__toolbar {
        opacity: 1;
      }
      .ai-suggestion__btn {
        display: grid;
        place-items: center;
        width: 22px;
        height: 22px;
        border-radius: 999px;
        cursor: pointer;
        transition:
          background 120ms ease,
          color 120ms ease,
          transform 80ms ease;
      }
      .ai-suggestion__btn:active {
        transform: scale(0.92);
      }
      .ai-suggestion__btn--accept {
        background: #1aa37e;
        color: #fff;
      }
      .ai-suggestion__btn--accept:hover {
        background: #168a6a;
      }
      .ai-suggestion__btn--reject {
        background: var(--surface-container);
        color: var(--on-surface-variant);
      }
      .ai-suggestion__btn--reject:hover {
        background: rgba(244, 67, 54, 0.12);
        color: #b3261e;
      }
      @keyframes ai-suggestion-fade-in {
        from {
          background: rgba(26, 163, 126, 0.45);
        }
        to {
          background: rgba(26, 163, 126, 0.16);
        }
      }
      @keyframes studio-toast-in {
        from {
          opacity: 0;
          transform: translateY(8px) scale(0.98);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      @keyframes studio-toast-out {
        from {
          opacity: 1;
          transform: translateY(0);
        }
        to {
          opacity: 0;
          transform: translateY(6px);
        }
      }
      .studio-toast-in {
        animation: studio-toast-in 220ms cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      .studio-toast-out {
        animation: studio-toast-out 220ms ease-in both;
      }
      @keyframes sop-review-fade-in {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .sop-review-fade-in {
        animation: sop-review-fade-in 280ms cubic-bezier(0.22, 1, 0.36, 1) both;
      }
    `;

/**
 * Inline CSS for the SOP studio. Lives next to the components so the
 * keyframes and Tiptap-specific selectors don't pollute globals.css.
 */
export function StudioStyles() {
  return <style dangerouslySetInnerHTML={{ __html: STUDIO_CSS }} />;
}
