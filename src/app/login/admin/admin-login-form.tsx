"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import {
  GlassAuthDivider,
  GlassAuthShell,
  GlassGoogleLabel,
  glassBannerClass,
} from "@/features/auth/glass-auth-shell";

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
    <GlassAuthShell
      icon="admin_panel_settings"
      title="Admin sign in"
      description="Email and password for operator accounts. End users should use the public login."
      showBrand={false}
      footer={
        <Link href="/login" className="hover:text-white/80">
          Back to public login
        </Link>
      }
    >
      {error ? (
        <div className={`mb-4 ${glassBannerClass("error")}`}>{error}</div>
      ) : null}

      <form className="space-y-4" onSubmit={(e) => void handlePassword(e)}>
        <div className="space-y-2">
          <label htmlFor="admin-email" className="block text-sm font-medium text-white/90">
            Email
          </label>
          <input
            id="admin-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
            className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="admin-password" className="block text-sm font-medium text-white/90">
            Password
          </label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-white py-3 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
        >
          Sign in
        </button>
      </form>

      <GlassAuthDivider />

      <button
        type="button"
        disabled={busy}
        onClick={() => void handleGoogle()}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-black/20 py-3 text-sm font-medium text-white transition hover:bg-white/5 disabled:opacity-50"
      >
        <GlassGoogleLabel />
      </button>
    </GlassAuthShell>
  );
}

export function AdminLoginForm() {
  return (
    <Suspense
      fallback={
        <GlassAuthShell title="Admin sign in" description="Loading…" showBrand={false}>
          <div className="h-24 animate-pulse rounded-xl bg-white/5" />
        </GlassAuthShell>
      }
    >
      <AdminLoginInner />
    </Suspense>
  );
}
