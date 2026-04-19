"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GlassBrandMark, GlassScene } from "@/components/layout/glass-scene";

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
      setCredError(errorMessages.CredentialsSignin);
      return;
    }
    if (res?.ok) {
      router.push(res.url ?? callbackUrl);
      router.refresh();
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

  return (
    <GlassScene>
      <div className="relative flex min-h-screen items-center justify-center px-4 py-14">
      <div className="w-full max-w-md space-y-7">
        <GlassBrandMark compact className="justify-center" />

        {!setup.hasSecret ? (
          <div className="glass-alert-warning">
            <strong className="font-semibold">Missing AUTH_SECRET.</strong> Add{" "}
            <code className="rounded bg-black/10 px-1 py-0.5 text-xs dark:bg-white/10">
              AUTH_SECRET
            </code>{" "}
            (or{" "}
            <code className="rounded bg-black/10 px-1 py-0.5 text-xs dark:bg-white/10">
              NEXTAUTH_SECRET
            </code>
            ) to{" "}
            <code className="rounded bg-black/10 px-1 py-0.5 text-xs dark:bg-white/10">
              .env
            </code>
            . Generate one with:{" "}
            <code className="rounded bg-black/10 px-1 py-0.5 text-xs dark:bg-white/10">
              openssl rand -base64 32
            </code>
          </div>
        ) : null}

        {!canUseAnyProvider ? (
          <div className="glass-alert-error">
            <strong className="font-semibold">No sign-in providers enabled.</strong>{" "}
            Add{" "}
            <code className="rounded bg-black/10 px-1 py-0.5 text-xs dark:bg-white/10">
              AUTH_SECRET
            </code>{" "}
            for email/password, or set{" "}
            <code className="rounded bg-black/10 px-1 py-0.5 text-xs dark:bg-white/10">
              GOOGLE_CLIENT_ID
            </code>
            /
            <code className="rounded bg-black/10 px-1 py-0.5 text-xs dark:bg-white/10">
              GOOGLE_CLIENT_SECRET
            </code>
            , or configure SMTP (
            <code className="text-xs">EMAIL_SERVER</code> +{" "}
            <code className="text-xs">EMAIL_FROM</code>). Restart{" "}
            <code className="rounded bg-black/10 px-1 py-0.5 text-xs dark:bg-white/10">
              pnpm dev
            </code>{" "}
            after editing{" "}
            <code className="rounded bg-black/10 px-1 py-0.5 text-xs dark:bg-white/10">
              .env
            </code>
            .
          </div>
        ) : null}

        {registered ? (
          <div className="glass-alert-success">
            Account created. Sign in with your email and password below.
          </div>
        ) : null}

        {errorText ? (
          <div className="glass-alert-error">
            {errorText}
          </div>
        ) : null}

        {credError ? (
          <div className="glass-alert-error">
            {credError}
          </div>
        ) : null}

        <Card className="glass-panel border-0 shadow-none">
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>
              Sign in with email and password, Google, or a magic link when SMTP
              is configured.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {setup.hasPasswordLogin ? (
              <form
                className="space-y-4"
                onSubmit={(e) => void handlePassword(e)}
              >
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    className="glass-input h-10"
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
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    className="glass-input h-10"
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
                  className="w-full shadow-[0_10px_36px_-10px_hsl(var(--primary)/0.55)]"
                  disabled={busy || !setup.hasSecret}
                >
                  Sign in
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  New here?{" "}
                  <Link
                    href="/register"
                    className="underline-offset-4 hover:underline"
                  >
                    Create an account
                  </Link>
                </p>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">
                Email/password sign-in needs{" "}
                <code className="text-xs">AUTH_SECRET</code> in{" "}
                <code className="text-xs">.env</code>.
              </p>
            )}

            {setup.hasGoogle ? (
              <>
                {setup.hasPasswordLogin ? (
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-white/35 dark:border-white/10" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="glass-chip">Or continue with</span>
                    </div>
                  </div>
                ) : null}
                <Button
                  className="w-full"
                  variant={setup.hasPasswordLogin ? "glass" : "default"}
                  disabled={busy || !setup.hasSecret}
                  onClick={() => void handleGoogle()}
                >
                  Continue with Google
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Google sign-in is disabled until{" "}
                <code className="text-xs">GOOGLE_CLIENT_ID</code> and{" "}
                <code className="text-xs">GOOGLE_CLIENT_SECRET</code> are set.
              </p>
            )}

            {setup.hasGoogle && setup.hasEmail ? (
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-white/35 dark:border-white/10" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="glass-chip">Or use email link</span>
                </div>
              </div>
            ) : setup.hasEmail && setup.hasPasswordLogin ? (
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-white/35 dark:border-white/10" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="glass-chip">Or magic link</span>
                </div>
              </div>
            ) : null}

            {setup.hasEmail ? (
              <form className="space-y-4" onSubmit={(e) => void handleMagicLink(e)}>
                {!setup.hasPasswordLogin ? (
                  <div className="space-y-2">
                    <Label htmlFor="magic-email">Email</Label>
                    <Input
                      id="magic-email"
                      type="email"
                      className="glass-input h-10"
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
                  className="w-full"
                  variant="glass"
                  disabled={busy || !setup.hasSecret || emailSent}
                >
                  {emailSent ? "Check your inbox" : "Email me a magic link"}
                </Button>
                {emailSent ? (
                  <p className="text-xs text-muted-foreground">
                    If SMTP is correct, you should receive a message shortly. Also
                    check spam.
                  </p>
                ) : null}
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">
                Magic link sign-in needs{" "}
                <code className="text-xs">EMAIL_SERVER</code> +{" "}
                <code className="text-xs">EMAIL_FROM</code>, or{" "}
                <code className="text-xs">SMTP_HOST</code> /{" "}
                <code className="text-xs">SMTP_USER</code> /{" "}
                <code className="text-xs">SMTP_PASSWORD</code>.
              </p>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          <Link
            href="/"
            className="rounded-lg px-2 py-1 underline-offset-4 backdrop-blur-sm hover:bg-white/40 hover:underline dark:hover:bg-white/[0.07]"
          >
            Back to home
          </Link>
        </p>
      </div>
      </div>
    </GlassScene>
  );
}

export function LoginForm({ setup }: { setup: LoginSetup }) {
  return (
    <Suspense
      fallback={
        <GlassScene>
          <div className="flex min-h-screen items-center justify-center p-8">
            <div className="glass-badge text-sm text-muted-foreground">Loading…</div>
          </div>
        </GlassScene>
      }
    >
      <LoginInner setup={setup} />
    </Suspense>
  );
}
