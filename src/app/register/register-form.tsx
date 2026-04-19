"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { GlassBrandMark, GlassScene } from "@/components/layout/glass-scene";
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

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          name: name.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not create account.");
        return;
      }
      router.push("/login?registered=1");
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <GlassScene>
      <div className="relative flex min-h-screen items-center justify-center px-4 py-14">
        <div className="w-full max-w-md space-y-7">
          <GlassBrandMark compact className="justify-center" />

          <Card className="glass-panel border-0 shadow-none">
            <CardHeader>
              <CardTitle>Create an account</CardTitle>
              <CardDescription>
                Use email and password, or sign in later with Google if your admin
                has enabled it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
                {error ? (
                  <div className="glass-alert-error">{error}</div>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="name">Name (optional)</Label>
                  <Input
                    id="name"
                    className="glass-input h-10"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={busy}
                    placeholder="Alex"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    className="glass-input h-10"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={busy}
                    placeholder="you@school.edu"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    className="glass-input h-10"
                    required
                    autoComplete="new-password"
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={busy}
                  />
                  <p className="text-xs text-muted-foreground">
                    At least 8 characters.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm password</Label>
                  <Input
                    id="confirm"
                    type="password"
                    className="glass-input h-10"
                    required
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    disabled={busy}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full shadow-[0_10px_36px_-10px_hsl(var(--primary)/0.55)]"
                  disabled={busy}
                >
                  {busy ? "Creating…" : "Create account"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login"
              className="rounded-lg px-1 underline-offset-4 hover:bg-white/40 hover:underline dark:hover:bg-white/[0.07]"
            >
              Sign in
            </Link>
            {" · "}
            <Link
              href="/"
              className="rounded-lg px-1 underline-offset-4 hover:bg-white/40 hover:underline dark:hover:bg-white/[0.07]"
            >
              Home
            </Link>
          </p>
        </div>
      </div>
    </GlassScene>
  );
}
