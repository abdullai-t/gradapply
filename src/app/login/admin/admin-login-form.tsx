"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AuthDivider,
  AuthShell,
  GoogleButtonContent,
} from "@/features/auth/auth-shell";

const DEFAULT_CALLBACK = "/admin";

function AdminLoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? DEFAULT_CALLBACK;
  const rawError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    rawError ? "Sign-in failed. Check your credentials." : null,
  );

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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
      setError("Invalid email or password.");
      return;
    }
    if (res?.ok) {
      router.push(res.url ?? callbackUrl);
      router.refresh();
    }
  }

  async function handleGoogle() {
    setBusy(true);
    await signIn("google", { callbackUrl });
    setBusy(false);
  }

  return (
    <AuthShell
      title="Admin sign in"
      description="Email and password for operator accounts. End users should use the public login."
      topBanners={
        error ? (
          <div key="error" className="glass-alert-error" role="alert">
            {error}
          </div>
        ) : undefined
      }
      footer={
        <Link
          href="/login"
          className="rounded-md px-2 py-1 underline-offset-4 hover:text-[var(--primary)] hover:underline"
        >
          Back to public login
        </Link>
      }
    >
      <form className="space-y-4" onSubmit={(e) => void handlePassword(e)}>
        <div className="space-y-1.5">
          <Label htmlFor="admin-email">Email</Label>
          <Input
            id="admin-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="admin-password">Password</Label>
          <Input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
          />
        </div>
        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={busy}
          disabled={busy || !email.trim() || !password}
        >
          Sign in
        </Button>
      </form>

      <AuthDivider>Or continue with</AuthDivider>

      <Button
        type="button"
        size="lg"
        variant="secondary"
        className="w-full"
        disabled={busy}
        onClick={() => void handleGoogle()}
      >
        <GoogleButtonContent />
      </Button>
    </AuthShell>
  );
}

export function AdminLoginForm() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Admin sign in" description="Loading…">
          <div className="h-32 animate-pulse rounded-2xl bg-[var(--surface-container)]" />
        </AuthShell>
      }
    >
      <AdminLoginInner />
    </Suspense>
  );
}
