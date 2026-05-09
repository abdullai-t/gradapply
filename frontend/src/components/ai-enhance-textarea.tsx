"use client";

import { apiFetch } from "@/lib/api-fetch";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Icon } from "@/components/icon";

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

  const handleEnhance = async () => {
    if (!value.trim() || enhancing) return;

    setEnhancing(true);
    try {
      const response = await apiFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `${enhancePrompt}\n\nIMPORTANT: Return ONLY the enhanced text, with no explanations, no "before/after" labels, no rationale. Just the improved version.\n\nText to enhance:\n${value}`,
          mode: "grammar",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to enhance text");
      }

      const data = (await response.json()) as { reply?: string };
      if (data.reply) {
        // Clean up the response in case the AI still adds labels
        let enhanced = data.reply;

        // Remove common AI explanation patterns
        enhanced = enhanced.replace(/^\*\*Before:\*\*[\s\S]*?\n\*\*After:\*\*/, '');
        enhanced = enhanced.replace(/^\*\*After:\*\*\s*/i, '');
        enhanced = enhanced.replace(/\n\n\*\*Changes and Rationale:\*\*[\s\S]*/i, '');
        enhanced = enhanced.trim();

        onChange(enhanced);
      }
    } catch (error) {
      console.error("Enhancement failed:", error);
    } finally {
      setEnhancing(false);
    }
  };

  return (
    <div className="relative">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
    </div>
  );
}
