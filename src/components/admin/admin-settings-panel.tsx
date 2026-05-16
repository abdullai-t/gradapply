"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ConfigResponse = {
  settings: {
    paystackSecretKeySet: boolean;
    paystackCurrency: string;
  };
};

type ErrorPayload = { error?: unknown; changed?: boolean };

function toErrorMessage(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value;
  if (value && typeof value === "object") {
    const maybe = value as {
      message?: unknown;
      formErrors?: unknown;
      fieldErrors?: unknown;
    };
    if (typeof maybe.message === "string" && maybe.message.trim()) return maybe.message;
    if (Array.isArray(maybe.formErrors) || maybe.fieldErrors) {
      return "Some settings fields are invalid. Review values and try again.";
    }
  }
  return fallback;
}

export function AdminSettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [paystackSecretKey, setPaystackSecretKey] = useState("");
  const [paystackCurrency, setPaystackCurrency] = useState("GHS");

  const [paystackSecretSet, setPaystackSecretSet] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/config", { cache: "no-store" });
    const json = (await res.json().catch(() => null)) as
      | ConfigResponse
      | ErrorPayload
      | null;
    if (!res.ok || !json || isErrorPayload(json)) {
      setError(
        json && isErrorPayload(json)
          ? toErrorMessage(json.error, "Load failed.")
          : "Load failed.",
      );
      setLoading(false);
      return;
    }
    setPaystackSecretSet(json.settings.paystackSecretKeySet);
    setPaystackCurrency(json.settings.paystackCurrency);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    const payload: Record<string, string> = {};
    if (paystackSecretKey.trim()) payload.paystackSecretKey = paystackSecretKey.trim();
    if (paystackCurrency.trim()) payload.paystackCurrency = paystackCurrency.trim().toUpperCase();

    const res = await fetch("/api/admin/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => null)) as
      | ErrorPayload
      | null;
    if (!res.ok) {
      setError(toErrorMessage(json?.error, "Could not save settings."));
      setSaving(false);
      return;
    }
    setPaystackSecretKey("");
    setMessage(json?.changed ? "Settings saved." : "No changes.");
    await load();
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="glass-panel flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading platform settings...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="glass-panel p-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Platform settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage Paystack API keys and billing currency.
        </p>
        {error ? <p className="mt-3 text-sm text-amber-200">{error}</p> : null}
        {message ? <p className="mt-3 text-sm text-emerald-200">{message}</p> : null}
      </div>

      <div className="glass-panel space-y-4 p-5">
        <h2 className="font-display text-xl font-semibold">Paystack</h2>
        <p className="text-sm text-muted-foreground">
          Secret key and currency used for checkout and webhooks.
        </p>
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">
            Paystack secret key {paystackSecretSet ? "(stored)" : "(not set)"}
          </label>
          <Input
            value={paystackSecretKey}
            onChange={(e) => setPaystackSecretKey(e.target.value)}
            placeholder={paystackSecretSet ? "******** (stored, enter to replace)" : "sk_test_..."}
            type="password"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">
            Paystack currency
          </label>
          <Input
            value={paystackCurrency}
            onChange={(e) => setPaystackCurrency(e.target.value)}
            placeholder="GHS"
          />
        </div>
      </div>

      <div className="glass-panel space-y-4 p-5">
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save settings
        </Button>
        <p className="text-xs text-muted-foreground">
          Secret fields are intentionally blank after refresh. If a key shows
          &quot;(stored)&quot;, it is saved; enter a new value only when replacing it.
        </p>
      </div>
    </div>
  );
}

function isErrorPayload(value: ConfigResponse | ErrorPayload): value is ErrorPayload {
  return "error" in value;
}
