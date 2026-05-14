"use client";

import { useState } from "react";

import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AuthNotice } from "@/features/auth/auth-shell";
import {
  CONTACT_TOPICS,
  type ContactTopic,
} from "@/lib/support";
import { cn } from "@/lib/utils";

const topicIcons: Record<ContactTopic, string> = {
  suggestion: "lightbulb",
  complaint: "report",
  bug: "bug_report",
  billing: "payments",
  other: "chat",
};

export function ContactForm({ configured }: { configured: boolean }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState<ContactTopic>("suggestion");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!configured) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/support/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          email: email.trim(),
          topic,
          message: message.trim(),
          website,
        }),
      });
      const data = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) {
        setError(data.error ?? "Could not send your message. Try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!configured) {
    return (
      <div className="glass-alert-warning text-sm">
        Contact form is unavailable until support email is configured. Set{" "}
        <code className="rounded bg-[var(--surface-container)] px-1.5 py-0.5 font-mono text-[11px]">
          NEXT_PUBLIC_SUPPORT_EMAIL
        </code>{" "}
        or{" "}
        <code className="rounded bg-[var(--surface-container)] px-1.5 py-0.5 font-mono text-[11px]">
          SUPPORT_INBOX_EMAIL
        </code>
        .
      </div>
    );
  }

  if (sent) {
    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border-2 border-[var(--primary-container)] bg-[var(--primary-fixed)] text-[var(--primary)] shadow-[0_4px_0_0_var(--primary-container)]">
          <Icon name="mark_email_read" fill size={30} />
        </div>
        <div className="space-y-2">
          <h2 className="t-headline-md m-0 text-[var(--on-surface)]">
            Message sent
          </h2>
          <p className="m-0 text-sm leading-relaxed text-[var(--on-surface-variant)]">
            Thanks for reaching out. We read every suggestion and complaint and
            usually reply within two business days at{" "}
            <span className="font-semibold text-[var(--on-surface)]">
              {email}
            </span>
            .
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setSent(false);
            setMessage("");
            setTopic("suggestion");
          }}
        >
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form className="space-y-6" onSubmit={(e) => void onSubmit(e)}>
      {error ? (
        <AuthNotice tone="error" title="Could not send">
          {error}
        </AuthNotice>
      ) : null}

      <fieldset className="space-y-2">
        <legend className="text-sm font-bold text-[var(--on-surface)]">
          What is this about?
        </legend>
        <div className="flex flex-wrap gap-2">
          {CONTACT_TOPICS.map((item) => {
            const active = topic === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setTopic(item.value)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border-2 px-4 py-2.5 text-sm font-semibold transition",
                  active
                    ? "border-[var(--primary)] bg-[var(--primary-fixed)] text-[var(--primary)] shadow-[0_2px_0_0_var(--primary-container)]"
                    : "border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] text-[var(--on-surface-variant)] hover:border-[var(--primary-container)] hover:text-[var(--on-surface)]",
                )}
                aria-pressed={active}
              >
                <Icon name={topicIcons[item.value]} size={16} />
                {item.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="contact-name">
            Name <span className="text-[var(--outline)]">(optional)</span>
          </Label>
          <Input
            id="contact-name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
            placeholder="Ada Lovelace"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-email">Email</Label>
          <Input
            id="contact-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
            placeholder="you@school.edu"
          />
        </div>
      </div>

      <div className="hidden" aria-hidden>
        <Label htmlFor="contact-website">Website</Label>
        <Input
          id="contact-website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact-message">Your message</Label>
        <Textarea
          id="contact-message"
          required
          minLength={20}
          maxLength={5000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={busy}
          placeholder="Tell us what happened, what you expected, or what we could do better…"
          className="min-h-[220px] text-base"
        />
        <p className="text-xs text-[var(--on-surface-variant)]">
          Minimum 20 characters. Include steps to reproduce for bugs.
        </p>
      </div>

      <Button
        type="submit"
        size="lg"
        className="w-full"
        loading={busy}
        disabled={busy || !email.trim() || message.trim().length < 20}
        iconRight="send"
      >
        Send message
      </Button>
    </form>
  );
}
