"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { capturePostHogEvent } from "@/lib/analytics/posthog-client";

import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AuthDivider,
  AuthNotice,
  AuthShell,
  GoogleButtonContent,
} from "@/features/auth/auth-shell";
import type { LoginSetup } from "@/auth";
import { AUTH_CONTINUE_PATH, isSafeAuthRedirectPath } from "@/lib/auth-redirect";
import { sendMagicLink, signInWithGoogle } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

const DEFAULT_CALLBACK = AUTH_CONTINUE_PATH;

function LoginTrustRow() {
  return (
    <ul className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-2 text-[11px] font-semibold text-[var(--outline)]">
      <li className="inline-flex items-center gap-1.5">
        <Icon name="lock" size={14} />
        Passwordless
      </li>
      <li className="inline-flex items-center gap-1.5">
        <Icon name="schedule" size={14} />
        Links expire quickly
      </li>
      <li className="inline-flex items-center gap-1.5">
        <Icon name="verified_user" size={14} />
        Your data stays private
      </li>
    </ul>
  );
}

function MagicLinkSentPanel({
  email,
  busy,
  resent,
  onResend,
  onChangeEmail,
}: {
  email: string;
  busy: boolean;
  resent: boolean;
  onResend: () => void;
  onChangeEmail: () => void;
}) {
  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border-2 border-[var(--primary-container)] bg-[var(--primary-fixed)] text-[var(--primary)] shadow-[0_4px_0_0_var(--primary-container)]">
        <Icon name="mark_email_unread" fill size={30} />
      </div>
      <div className="space-y-2">
        <h2 className="t-headline-md m-0 text-[var(--on-surface)]">
          Check your inbox
        </h2>
        <p className="m-0 text-sm leading-relaxed text-[var(--on-surface-variant)]">
          We sent a secure sign-in link to{" "}
          <span className="font-semibold text-[var(--on-surface)]">{email}</span>
          . Open it on this device to continue.
        </p>
      </div>
      {resent ? (
        <AuthNotice tone="success" title="Link sent again">
          If it still does not arrive, check spam or try Google sign-in.
        </AuthNotice>
      ) : (
        <AuthNotice tone="info">
          Links expire after a short time. You can close this tab and return from
          your email.
        </AuthNotice>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          size="lg"
          className="flex-1"
          variant="secondary"
          loading={busy}
          disabled={busy}
          onClick={onResend}
          iconRight="refresh"
        >
          Resend link
        </Button>
        <Button
          type="button"
          size="lg"
          className="flex-1"
          variant="outline"
          disabled={busy}
          onClick={onChangeEmail}
        >
          Use a different email
        </Button>
      </div>
    </div>
  );
}

function LoginInner({ setup }: { setup: LoginSetup }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawCallback = searchParams.get("callbackUrl");
  const callbackUrl =
    rawCallback && isSafeAuthRedirectPath(rawCallback)
      ? rawCallback
      : DEFAULT_CALLBACK;

  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [resent, setResent] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const canSignIn = setup.hasGoogle || setup.hasEmail;
  const busy = emailBusy || googleBusy;

  async function sendMagicLinkTo(targetEmail: string) {
    setFormError(null);
    setEmailBusy(true);
    try {
      await sendMagicLink(targetEmail);
      capturePostHogEvent("magic_link_requested", { email: targetEmail.trim() });
      setEmailSent(true);
      return true;
    } catch {
      setFormError("Could not send the magic link. Try again or use Google.");
      return false;
    } finally {
      setEmailBusy(false);
    }
  }

  async function handleGoogle() {
    setFormError(null);
    setGoogleBusy(true);
    try {
      capturePostHogEvent("google_sign_in_clicked");
      await signInWithGoogle();
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setFormError("Google sign-in failed. Try again.");
    } finally {
      setGoogleBusy(false);
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !setup.hasEmail) return;
    await sendMagicLinkTo(email);
  }

  async function handleResend() {
    if (!email.trim()) return;
    const ok = await sendMagicLinkTo(email);
    if (ok) setResent(true);
  }

  function handleChangeEmail() {
    setEmailSent(false);
    setResent(false);
    setFormError(null);
    setEmail("");
  }

  const notices: React.ReactNode[] = [];
  if (!canSignIn) {
    notices.push(
      <AuthNotice key="providers" tone="error" title="Sign-in unavailable">
        Firebase Auth is not configured on this deployment.
      </AuthNotice>,
    );
  }
  if (formError) {
    notices.push(
      <AuthNotice key="form-error" tone="error">
        {formError}
      </AuthNotice>,
    );
  }

  const footer = (
    <>
      <Link
        href="/"
        className="underline-offset-4 hover:text-[var(--primary)] hover:underline"
      >
        Home
      </Link>
      {" · "}
      <Link
        href="/support"
        className="underline-offset-4 hover:text-[var(--primary)] hover:underline"
      >
        Support
      </Link>
    </>
  );

  if (emailSent) {
    return (
      <AuthShell
        title="Almost there"
        description="One tap in your inbox finishes sign-in."
        footer={footer}
      >
        <MagicLinkSentPanel
          email={email}
          busy={emailBusy}
          resent={resent}
          onResend={() => void handleResend()}
          onChangeEmail={handleChangeEmail}
        />
        <LoginTrustRow />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Welcome back"
      description="Pick up your applications where you left off — sign in with Google or a one-time email link."
      footer={footer}
    >
      {notices.length ? <div className="mb-5 space-y-3">{notices}</div> : null}

      {setup.hasGoogle ? (
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="w-full bg-[var(--surface-container-lowest)]"
          loading={googleBusy}
          disabled={busy}
          onClick={() => void handleGoogle()}
        >
          <GoogleButtonContent />
        </Button>
      ) : null}

      {setup.hasGoogle && setup.hasEmail ? (
        <AuthDivider>Or use email</AuthDivider>
      ) : null}

      {setup.hasEmail ? (
        <form className="space-y-4" onSubmit={(e) => void handleMagicLink(e)}>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email address</Label>
            <div className="relative">
              <Icon
                name="mail"
                size={18}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--outline)]"
              />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus={!setup.hasGoogle}
                placeholder="you@school.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={emailBusy}
                className="pl-11"
              />
            </div>
            <p className="text-xs leading-relaxed text-[var(--on-surface-variant)]">
              No password needed — we will email you a secure link.
            </p>
          </div>
          <Button
            type="submit"
            size="lg"
            className="w-full"
            loading={emailBusy}
            disabled={busy || !email.trim()}
            iconRight="send"
          >
            Email me a sign-in link
          </Button>
        </form>
      ) : (
        <p className="text-sm text-[var(--on-surface-variant)]">
          Email sign-in is not configured on this server.
        </p>
      )}

      {!setup.hasGoogle && !setup.hasEmail ? null : <LoginTrustRow />}
    </AuthShell>
  );
}

export function LoginForm({ setup }: { setup: LoginSetup }) {
  return (
    <Suspense
      fallback={
        <AuthShell
          title="Welcome back"
          description="Loading your sign-in options…"
        >
          <div className="space-y-3">
            <div className="h-12 animate-pulse rounded-xl bg-[var(--surface-container)]" />
            <div className="h-12 animate-pulse rounded-xl bg-[var(--surface-container)]" />
            <div className="h-12 animate-pulse rounded-xl bg-[var(--surface-container)]" />
          </div>
        </AuthShell>
      }
    >
      <LoginInner setup={setup} />
    </Suspense>
  );
}
