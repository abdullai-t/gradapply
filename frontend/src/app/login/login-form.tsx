"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell, AuthDivider, GoogleButtonContent } from "@/features/auth/auth-shell";

const DEFAULT_CALLBACK = "/dashboard";

const errorMessages: Record<string, string> = {
  Configuration:
    "Server configuration error. Check that at least one sign-in provider and AUTH_SECRET are set in .env.",
  AccessDenied: "Sign in was cancelled or you do not have access.",
  Verification:
    "The sign-in link is invalid or has expired. Request a new magic link.",
  OAuthSignin:
    "Could not start OAuth sign-in. Verify Google OAuth credentials and callback URL.",
  OAuthCallback:
    "OAuth callback failed. In Google Cloud Console, add Authorized redirect URI: http://localhost:3000/api/auth/callback/google (replace host if deployed).",
  OAuthAccountNotLinked:
    "This email is already used with another sign-in method.",
  CredentialsSignin: "Invalid email or password.",
  Default: "Sign-in failed. Try again or contact support.",
};

export type LoginSetup = {
  hasGoogle: boolean;
  hasEmail: boolean;
  hasSecret: boolean;
  hasPasswordLogin: boolean;
  providerCount: number;
};

function LoginInner({ setup }: { setup: LoginSetup }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawError = searchParams.get("error");
  const registered = searchParams.get("registered") === "1";
  const verified = searchParams.get("verified") === "1";
  const verifyEmail = searchParams.get("verify_email") === "1";
  const verifyError = searchParams.get("verify_error") === "1";
  const errorKey = rawError && errorMessages[rawError] ? rawError : null;
  const errorText = errorKey
    ? errorMessages[errorKey]
    : rawError
      ? `${errorMessages.Default} (${rawError})`
      : null;

  const callbackUrl = searchParams.get("callbackUrl") ?? DEFAULT_CALLBACK;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [credError, setCredError] = useState<string | null>(null);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  const canUseAnyProvider = setup.providerCount > 0;

  async function handleGoogle() {
    setBusy(true);
    await signIn("google", { callbackUrl });
    setBusy(false);
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setCredError(null);
    if (!email.trim() || !password) return;
    setBusy(true);
    const res = await signIn("credentials", {
      email: email.trim(),
      password,
      redirect: false,
      callbackUrl,
    });
    setBusy(false);
    if (res?.error) {
      setCredError(
        "Invalid email or password. If you just registered, verify your email first.",
      );
      return;
    }
    if (res?.ok) {
      router.push(res.url ?? callbackUrl);
      router.refresh();
    }
  }

  async function resendVerificationEmail() {
    if (!email.trim()) {
      setCredError("Enter your email to resend verification.");
      return;
    }
    setResendingVerification(true);
    setCredError(null);
    try {
      await fetch("/api/auth/verify-email/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      setVerificationSent(true);
    } finally {
      setResendingVerification(false);
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    const res = await signIn("nodemailer", {
      email: email.trim(),
      callbackUrl,
      redirect: false,
    });
    setBusy(false);
    if (res?.error) {
      alert(`Could not send email: ${res.error}`);
      return;
    }
    setEmailSent(true);
  }

  // ---- Top-of-card setup banners ----
  const banners: React.ReactNode[] = [];
  if (!setup.hasSecret) {
    banners.push(
      <div key="secret" className="glass-alert-warning">
        <strong className="font-bold">Missing AUTH_SECRET.</strong> Add{" "}
        <CodeChip>AUTH_SECRET</CodeChip> (or <CodeChip>NEXTAUTH_SECRET</CodeChip>) to{" "}
        <CodeChip>.env</CodeChip>. Generate with{" "}
        <CodeChip>openssl rand -base64 32</CodeChip>.
      </div>,
    );
  }
  if (!canUseAnyProvider) {
    banners.push(
      <div key="providers" className="glass-alert-error">
        <strong className="font-bold">No sign-in providers enabled.</strong> Add{" "}
        <CodeChip>AUTH_SECRET</CodeChip> for email/password, or{" "}
        <CodeChip>GOOGLE_CLIENT_ID</CodeChip>/<CodeChip>GOOGLE_CLIENT_SECRET</CodeChip>,
        or SMTP (<CodeChip>EMAIL_SERVER</CodeChip> + <CodeChip>EMAIL_FROM</CodeChip>).
      </div>,
    );
  }
  if (registered) {
    banners.push(
      <div key="registered" className="glass-alert-success">
        Account created. Sign in with your email and password below.
      </div>,
    );
  }
  if (verifyEmail) {
    banners.push(
      <div key="verify-email" className="glass-alert-success">
        Verify your email to activate password sign-in. We sent a verification
        link if email delivery is configured.
      </div>,
    );
  }
  if (verified) {
    banners.push(
      <div key="verified" className="glass-alert-success">
        Email verified successfully. You can sign in now.
      </div>,
    );
  }
  if (verifyError) {
    banners.push(
      <div key="verify-error" className="glass-alert-error">
        Verification link is invalid or expired. Enter your email and resend
        verification.
      </div>,
    );
  }
  if (errorText) {
    banners.push(
      <div key="error" className="glass-alert-error">
        {errorText}
      </div>,
    );
  }
  if (credError) {
    banners.push(
      <div key="cred" className="glass-alert-error">
        {credError}
      </div>,
    );
  }

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in with email and password, Google, or a magic link when SMTP is configured."
      topBanners={banners.length ? banners : undefined}
      footer={
        <>
          <Link
            href="/support"
            className="rounded-md px-2 py-1 underline-offset-4 hover:text-[var(--primary)] hover:underline"
          >
            Support
          </Link>
          {" · "}
          <Link
            href="/"
            className="rounded-md px-2 py-1 underline-offset-4 hover:text-[var(--primary)] hover:underline"
          >
            Back to home
          </Link>
        </>
      }
    >
      {setup.hasPasswordLogin ? (
        <form
          className="space-y-4"
          onSubmit={(e) => void handlePassword(e)}
        >
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@school.edu"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setCredError(null);
              }}
              disabled={busy || !setup.hasSecret}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setCredError(null);
              }}
              disabled={busy || !setup.hasSecret}
            />
          </div>
          <Button
            type="submit"
            size="lg"
            className="w-full"
            loading={busy}
            disabled={busy || !setup.hasSecret}
            iconRight="arrow_forward"
          >
            Sign in
          </Button>
          <div className="flex items-center justify-center gap-2 text-xs text-[var(--on-surface-variant)]">
            <button
              type="button"
              className="underline-offset-4 hover:underline"
              disabled={resendingVerification}
              onClick={() => void resendVerificationEmail()}
            >
              {resendingVerification
                ? "Resending verification…"
                : "Resend verification email"}
            </button>
            {verificationSent ? <span>Check your inbox.</span> : null}
          </div>
          <p className="text-center text-sm text-[var(--on-surface-variant)]">
            New user? Use Google sign-in, magic link, or ask support to create
            your account access.
          </p>
        </form>
      ) : (
        <p className="text-sm text-[var(--on-surface-variant)]">
          Email/password sign-in needs <CodeChip>AUTH_SECRET</CodeChip> in{" "}
          <CodeChip>.env</CodeChip>.
        </p>
      )}

      {setup.hasGoogle ? (
        <>
          {setup.hasPasswordLogin ? (
            <AuthDivider>Or continue with</AuthDivider>
          ) : null}
          <Button
            size="lg"
            variant={setup.hasPasswordLogin ? "secondary" : "primary"}
            className="w-full"
            disabled={busy || !setup.hasSecret}
            onClick={() => void handleGoogle()}
          >
            <GoogleButtonContent />
          </Button>
        </>
      ) : (
        <p className="mt-5 text-sm text-[var(--on-surface-variant)]">
          Google sign-in is disabled until <CodeChip>GOOGLE_CLIENT_ID</CodeChip>{" "}
          and <CodeChip>GOOGLE_CLIENT_SECRET</CodeChip> are set.
        </p>
      )}

      {setup.hasEmail ? (
        <>
          <AuthDivider>
            {setup.hasGoogle ? "Or use email link" : "Or magic link"}
          </AuthDivider>
          <form
            className="space-y-3"
            onSubmit={(e) => void handleMagicLink(e)}
          >
            {!setup.hasPasswordLogin ? (
              <div className="space-y-1.5">
                <Label htmlFor="magic-email">Email</Label>
                <Input
                  id="magic-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@school.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy || !setup.hasSecret}
                />
              </div>
            ) : null}
            <Button
              type="submit"
              size="lg"
              variant="ghost"
              className="w-full border border-[var(--outline-variant)]"
              loading={busy && !emailSent}
              disabled={busy || !setup.hasSecret || emailSent}
              icon="send"
            >
              {emailSent ? "Check your inbox" : "Email me a magic link"}
            </Button>
            {emailSent ? (
              <p className="text-xs text-[var(--on-surface-variant)]">
                If SMTP is correct, you should receive a message shortly. Also
                check spam.
              </p>
            ) : null}
          </form>
        </>
      ) : null}
    </AuthShell>
  );
}

function CodeChip({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-md bg-[var(--surface-container)] px-1.5 py-0.5 font-mono text-[0.7rem] text-[var(--on-surface)]">
      {children}
    </code>
  );
}

export function LoginForm({ setup }: { setup: LoginSetup }) {
  return (
    <Suspense
      fallback={
        <AuthShell
          title="Welcome back"
          description="Loading…"
        >
          <div className="h-32 animate-pulse rounded-2xl bg-[var(--surface-container)]" />
        </AuthShell>
      }
    >
      <LoginInner setup={setup} />
    </Suspense>
  );
}
