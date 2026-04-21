"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ChatMode = "grammar" | "sop" | "email" | "feedback" | "general";

type Msg = {
  id: string;
  role: string;
  content: string;
  mode: string | null;
};

type AgentMeta = {
  tabMode: string;
  effectiveMode: string;
  label: string;
  provider: string;
  model: string | null;
  routedFromGeneral: boolean;
  creditFallback: boolean;
};

export default function AssistantPage() {
  const [mode, setMode] = useState<ChatMode>("general");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastAgent, setLastAgent] = useState<AgentMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [planTier, setPlanTier] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/billing/status", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as { planTier?: string };
      })
      .then((json) => {
        if (!active) return;
        setPlanTier(json?.planTier ?? null);
      })
      .catch(() => {
        if (!active) return;
        setPlanTier(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const load = async (m: ChatMode) => {
    const qs = `?mode=${encodeURIComponent(m)}`;
    const res = await fetch(`/api/chat${qs}`);
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setError(j.error ?? `Could not load chat (${res.status})`);
      return;
    }
    setError(null);
    setMessages(await res.json());
  };

  useEffect(() => {
    void load(mode);
  }, [mode]);

  useEffect(() => {
    setLastAgent(null);
  }, [mode]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: input,
        mode,
      }),
    });
    setLoading(false);
    if (res.ok) {
      const data = (await res.json()) as { agent?: AgentMeta };
      if (data.agent) setLastAgent(data.agent);
      setInput("");
      await load(mode);
    } else {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setError(
        typeof j.error === "string"
          ? j.error
          : `Request failed (${res.status}). Check your API keys in .env and restart the dev server.`,
      );
    }
  };

  const hint =
    mode === "general"
      ? "Ask anything about your applications."
      : mode === "grammar"
        ? "Paste paragraphs; the model will tighten language."
        : mode === "sop"
          ? "Work through narrative arcs, specificity, and fit."
          : mode === "email"
            ? "Polish outreach messages before you send them."
            : "Ask for blunt, constructive critique on strategy.";

  if (planTier === "FREE") {
    return (
      <Card className="glass-panel border-white/10">
        <CardHeader>
          <CardTitle className="font-display text-lg">AI assistant</CardTitle>
          <CardDescription>
            The AI assistant is available on PLUS and PRO plans.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            Upgrade your plan in Settings to unlock assistant chats.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">AI assistant</h1>
        <p className="text-muted-foreground">
          Multiple task-tuned agents run under the hood; each reply is grounded in your{" "}
          <Link href="/profile">profile</Link> and{" "}
          <Link href="/documents">uploaded documents</Link> (CV, SOP drafts, etc.) when
          available. On <strong>General</strong>, the app infers the best agent from your
          message. Each tab keeps its own thread.
        </p>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      <Tabs value={mode} onValueChange={(v) => setMode(v as ChatMode)}>
        <TabsList className="grid w-full grid-cols-2 gap-2 md:grid-cols-5">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="grammar">Grammar</TabsTrigger>
          <TabsTrigger value="sop">SOP</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="border-border/80 shadow-md">
        <CardHeader>
          <CardTitle>Conversation</CardTitle>
          <CardDescription>
            {lastAgent ? (
              <span className="block space-y-1">
                <span>
                  Last reply: <strong>{lastAgent.label}</strong> via{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    {lastAgent.provider}
                  </code>
                  {lastAgent.model ? (
                    <>
                      {" "}
                      (<span className="tabular-nums">{lastAgent.model}</span>)
                    </>
                  ) : null}
                </span>
                {lastAgent.creditFallback ? (
                  <span className="block text-emerald-700 dark:text-emerald-400">
                    Credits ran low on the preferred API — this reply used another configured provider.
                  </span>
                ) : null}
                {lastAgent.routedFromGeneral ? (
                  <span className="block text-amber-600 dark:text-amber-400">
                    Auto-routed from General using quick intent hints from your prompt.
                  </span>
                ) : null}
              </span>
            ) : (
              hint
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ScrollArea className="h-[420px] rounded-xl border bg-muted/30 p-4">
            <div className="space-y-4">
              {messages.length === 0 && (
                <div className="text-sm text-muted-foreground">
                  Say hello — your profile context is included automatically when
                  available.
                </div>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={
                    msg.role === "user"
                      ? "ml-auto max-w-[85%] rounded-2xl bg-primary px-4 py-3 text-sm text-primary-foreground shadow-sm"
                      : "mr-auto max-w-[85%] rounded-2xl border bg-card px-4 py-3 text-sm shadow-sm"
                  }
                >
                  <div className="mb-1 text-[11px] uppercase tracking-wide opacity-70">
                    {msg.role === "user" ? "You" : "Assistant"}
                  </div>
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          <div className="flex flex-col gap-3 md:flex-row">
            <Textarea
              placeholder="Ask a question or paste text to work on…"
              className="min-h-[96px] flex-1"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <Button
              className="h-11 md:self-end"
              onClick={() => void send()}
              disabled={loading}
            >
              <Send className="mr-2 h-4 w-4" />
              {loading ? "Thinking…" : "Send"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Tip: use Cmd/Ctrl + Enter to send without leaving the keyboard.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
