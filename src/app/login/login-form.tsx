"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import {
  GlassAuthDivider,
  GlassAuthShell,
  GlassGoogleLabel,
  glassBannerClass,
} from "@/features/auth/glass-auth-shell";

const DEFAULT_CALLBACK = "/dashboard";

const errorMessages: Record<string, string> = {
  Configuration:
    "Sign-in is not configured on this server. Contact support if this persists.",
  AccessDenied: "Sign in was cancelled or you do not have access.",
  Verification: "The sign-in link is invalid or has expired. Request a new one.",
  OAuthSignin: "Could not start Google sign-in. Try again later.",
  OAuthCallback: "Google sign-in failed. Check your account and try again.",
  OAuthAccountNotLinked:
    "This email is already used with another sign-in method.",
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
  const searchParams = useSearchParams();
  const rawError = searchParams.get("error");
  const verified = searchParams.get("verified") === "1";
  const verifyError = searchParams.get("verify_error") === "1";
  const errorKey = rawError && errorMessages[rawError] ? rawError : null;
  const errorText = errorKey
    ? errorMessages[errorKey]
    : rawError
      ? `${errorMessages.Default} (${rawError})`
      : null;

  const callbackUrl = searchParams.get("callbackUrl") ?? DEFAULT_CALLBACK;

  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const canSignIn = setup.hasGoogle || setup.hasEmail;

  async function handleGoogle() {
    setBusy(true);
    await signIn("google", { callbackUrl });
    setBusy(false);
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !setup.hasEmail) return;
    setBusy(true);
    const res = await signIn("nodemailer", {
      email: email.trim(),
      callbackUrl,
      redirect: false,
    });
    setBusy(false);
    if (res?.error) {
      alert("Could not send magic link. Try again or use Google sign-in.");
      return;
    }
    setEmailSent(true);
  }

  const banners: React.ReactNode[] = [];
  if (!canSignIn) {
    banners.push(
      <div key="providers" className={glassBannerClass("error")}>
        Sign-in is unavailable right now. Magic email or Google must be enabled on
        this deployment.
      </div>,
    );
  }
  if (verified) {
    banners.push(
      <div key="verified" className={glassBannerClass("success")}>
        Email verified. You can sign in now.
      </div>,
    );
  }
  if (verifyError) {
    banners.push(
      <div key="verify-error" className={glassBannerClass("error")}>
        Verification link is invalid or expired.
      </div>,
    );
  }
  if (errorText) {
    banners.push(
      <div key="error" className={glassBannerClass("error")}>
        {errorText}
      </div>,
    );
  }
  if (emailSent) {
    banners.push(
      <div key="sent" className={glassBannerClass("success")}>
        Check your inbox for a magic link. It may take a minute — also check spam.
      </div>,
    );
  }

  return (
    <GlassAuthShell
      title="Welcome to GradApply"
      description="Please sign in or sign up below."
      topBanners={banners.length ? banners : undefined}
      footer={
        <>
          <Link href="/" className="hover:text-white/80">
            Back to home
          </Link>
          {" · "}
          <Link href="/support" className="hover:text-white/80">
            Support
          </Link>
        </>
      }
    >
      {setup.hasEmail ? (
        <form className="space-y-4" onSubmit={(e) => void handleMagicLink(e)}>
          <div className="space-y-2">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-white/90"
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@school.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy || emailSent}
              className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-white/30 focus:ring-2 focus:ring-white/10"
            />
            <p className="text-xs leading-relaxed text-white/40">
              A magic link will be sent to your email to complete the sign-in
              process.
            </p>
          </div>
          <button
            type="submit"
            disabled={busy || emailSent || !email.trim()}
            className="w-full rounded-xl bg-white py-3 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {emailSent ? "Link sent" : "Continue with email"}
          </button>
        </form>
      ) : (
        <p className="text-center text-sm text-white/50">
          Email sign-in is not configured on this server.
        </p>
      )}

      {setup.hasGoogle && setup.hasEmail ? <GlassAuthDivider /> : null}

      {setup.hasGoogle ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleGoogle()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-black/20 py-3 text-sm font-medium text-white transition hover:bg-white/5 disabled:opacity-50"
        >
          <GlassGoogleLabel />
        </button>
      ) : (
        <p className="text-center text-sm text-white/50">
          Google sign-in is not available on this deployment.
        </p>
      )}
    </GlassAuthShell>
  );
}

export function LoginForm({ setup }: { setup: LoginSetup }) {
  return (
    <Suspense
      fallback={
        <GlassAuthShell title="Welcome to GradApply" description="Loading…">
          <div className="h-24 animate-pulse rounded-xl bg-white/5" />
        </GlassAuthShell>
      }
    >
      <LoginInner setup={setup} />
    </Suspense>
  );
}
