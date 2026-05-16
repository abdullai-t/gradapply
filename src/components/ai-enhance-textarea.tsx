"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Icon } from "@/components/icon";
import { messageFromApiErrorPayload } from "@/lib/api-error-json";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  enhancePrompt: string;
};

export function AIEnhanceTextarea({
  value,
  onChange,
  placeholder,
  className,
  enhancePrompt,
}: Props) {
  const [enhancing, setEnhancing] = useState(false);
  const [enhanceError, setEnhanceError] = useState<string | null>(null);

  const handleEnhance = async () => {
    if (!value.trim() || enhancing) return;

    setEnhancing(true);
    setEnhanceError(null);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `${enhancePrompt}\n\nIMPORTANT: Return ONLY the enhanced text, with no explanations, no "before/after" labels, no rationale. Just the improved version.\n\nText to enhance:\n${value}`,
          mode: "grammar",
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        reply?: string;
        error?: unknown;
      };

      if (!response.ok) {
        setEnhanceError(messageFromApiErrorPayload(data));
        return;
      }

      if (data.reply) {
        // Clean up the response in case the AI still adds labels
        let enhanced = data.reply;

        // Remove common AI explanation patterns
        enhanced = enhanced.replace(/^\*\*Before:\*\*[\s\S]*?\n\*\*After:\*\*/, '');
        enhanced = enhanced.replace(/^\*\*After:\*\*\s*/i, '');
        enhanced = enhanced.replace(/\n\n\*\*Changes and Rationale:\*\*[\s\S]*/i, '');
        enhanced = enhanced.trim();

        onChange(enhanced);
      } else {
        setEnhanceError("No enhanced text was returned. Try again or shorten the input.");
      }
    } catch (error) {
      console.error("Enhancement failed:", error);
      setEnhanceError(
        error instanceof Error ? error.message : "Something went wrong.",
      );
    } finally {
      setEnhancing(false);
    }
  };

  return (
    <div className="relative">
      <Textarea
        value={value}
        onChange={(e) => {
          setEnhanceError(null);
          onChange(e.target.value);
        }}
        placeholder={placeholder}
        className={className}
      />
      {value.trim() && (
        <button
          type="button"
          onClick={handleEnhance}
          disabled={enhancing}
          className="absolute right-3 bottom-3 grid h-8 w-8 place-items-center rounded-lg bg-[var(--primary)] text-white shadow-sm transition-all hover:scale-105 hover:shadow-md disabled:opacity-50 disabled:hover:scale-100"
          title="Enhance with AI"
        >
          {enhancing ? (
            <Icon name="hourglass_empty" size={18} className="animate-spin" />
          ) : (
            <Icon name="auto_awesome" fill size={18} />
          )}
        </button>
      )}
      {enhanceError ? (
        <p className="mt-2 text-xs text-[var(--error)]" role="alert">
          {enhanceError}
        </p>
      ) : null}
    </div>
  );
}
