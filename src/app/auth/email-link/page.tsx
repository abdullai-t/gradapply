"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/features/auth/auth-shell";
import {
  completeMagicLinkSignIn,
  getStoredEmailForSignIn,
} from "@/lib/auth-client";
import { AUTH_CONTINUE_PATH, isSafeAuthRedirectPath } from "@/lib/auth-redirect";

function EmailLinkInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawCallback = searchParams.get("callbackUrl");
  const callbackUrl =
    rawCallback && isSafeAuthRedirectPath(rawCallback)
      ? rawCallback
      : AUTH_CONTINUE_PATH;

  const finishOnceRef = useRef(false);

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsEmail, setNeedsEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finishSignIn = useCallback(
    async (targetEmail: string) => {
      if (finishOnceRef.current) return;
      finishOnceRef.current = true;
      setBusy(true);
      setError(null);
      try {
        await completeMagicLinkSignIn(targetEmail);
        router.push(callbackUrl);
        router.refresh();
      } catch (e) {
        finishOnceRef.current = false;
        setNeedsEmail(true);
        setError(
          e instanceof Error
            ? e.message
            : "Could not complete sign-in. Request a new link.",
        );
      } finally {
        setBusy(false);
      }
    },
    [callbackUrl, router],
  );

  useEffect(() => {
    const stored = getStoredEmailForSignIn();
    if (stored) {
      setEmail(stored);
      void finishSignIn(stored);
    } else {
      setNeedsEmail(true);
    }
  }, [finishSignIn]);

  return (
    <AuthShell
      title="Finishing sign-in"
      description={
        needsEmail
          ? "Confirm the email address that received the link."
          : "Verifying your secure link…"
      }
      footer={
        <Link
          href="/login"
          className="text-sm font-semibold text-[var(--primary)] underline-offset-4 hover:underline"
        >
          Back to login
        </Link>
      }
    >
      {error ? (
        <p className="mb-4 text-sm text-[var(--error)]" role="alert">
          {error}
        </p>
      ) : null}
      {needsEmail ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void finishSignIn(email);
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="email-link-email">Email</Label>
            <Input
              id="email-link-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
          </div>
          <Button
            type="submit"
            size="lg"
            className="w-full"
            loading={busy}
            disabled={busy || !email.trim()}
          >
            Continue
          </Button>
        </form>
      ) : (
        <p className="text-sm text-[var(--on-surface-variant)]">
          Please wait…
        </p>
      )}
    </AuthShell>
  );
}

export default function EmailLinkPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Finishing sign-in" description="Loading…">
          <p className="text-sm text-[var(--on-surface-variant)]">Please wait…</p>
        </AuthShell>
      }
    >
      <EmailLinkInner />
    </Suspense>
  );
}
