"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ConfigResponse = {
  settings: {
    stripePricePlus: string;
    stripePricePro: string;
    stripePriceCreditsPack: string;
    paystackPlanCodePlus: string;
    paystackPlanCodePro: string;
    paystackAmountCreditsMinor: number;
    allowanceFree: number;
    allowancePlus: number;
    allowancePro: number;
    creditsPackSize: number;
  };
};

type ErrorPayload = { error?: unknown; changed?: boolean };

function humanizeFieldName(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

function validationErrorMessage(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const maybe = value as {
    formErrors?: unknown;
    fieldErrors?: unknown;
  };
  const formErrors = Array.isArray(maybe.formErrors)
    ? maybe.formErrors.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    : [];
  if (formErrors.length > 0) return formErrors[0]!;

  if (!maybe.fieldErrors || typeof maybe.fieldErrors !== "object") return null;
  const entries = Object.entries(maybe.fieldErrors as Record<string, unknown>)
    .map(([field, errs]) => {
      if (!Array.isArray(errs)) return null;
      const msg = errs.find((e): e is string => typeof e === "string" && e.trim().length > 0);
      if (!msg) return null;
      return `${humanizeFieldName(field)}: ${msg}`;
    })
    .filter((v): v is string => Boolean(v));
  return entries.length > 0 ? entries.slice(0, 2).join(" | ") : null;
}

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
      return (
        validationErrorMessage(value) ??
        "Some pricing fields are invalid. Review values and try again."
      );
    }
  }
  return fallback;
}

export function AdminPricingPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [stripePricePlus, setStripePricePlus] = useState("");
  const [stripePricePro, setStripePricePro] = useState("");
  const [stripePriceCreditsPack, setStripePriceCreditsPack] = useState("");
  const [paystackPlanCodePlus, setPaystackPlanCodePlus] = useState("");
  const [paystackPlanCodePro, setPaystackPlanCodePro] = useState("");
  const [paystackAmountCreditsMinor, setPaystackAmountCreditsMinor] = useState("5000");
  const [allowanceFree, setAllowanceFree] = useState("35");
  const [allowancePlus, setAllowancePlus] = useState("200");
  const [allowancePro, setAllowancePro] = useState("600");
  const [creditsPackSize, setCreditsPackSize] = useState("50");

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
    setStripePricePlus(json.settings.stripePricePlus);
    setStripePricePro(json.settings.stripePricePro);
    setStripePriceCreditsPack(json.settings.stripePriceCreditsPack);
    setPaystackPlanCodePlus(json.settings.paystackPlanCodePlus);
    setPaystackPlanCodePro(json.settings.paystackPlanCodePro);
    setPaystackAmountCreditsMinor(String(json.settings.paystackAmountCreditsMinor));
    setAllowanceFree(String(json.settings.allowanceFree));
    setAllowancePlus(String(json.settings.allowancePlus));
    setAllowancePro(String(json.settings.allowancePro));
    setCreditsPackSize(String(json.settings.creditsPackSize));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);

    const payload: Record<string, string | number> = {
      paystackAmountCreditsMinor: Number(paystackAmountCreditsMinor || "0"),
      allowanceFree: Number(allowanceFree || "0"),
      allowancePlus: Number(allowancePlus || "0"),
      allowancePro: Number(allowancePro || "0"),
      creditsPackSize: Number(creditsPackSize || "0"),
    };
    if (stripePricePlus.trim()) payload.stripePricePlus = stripePricePlus.trim();
    if (stripePricePro.trim()) payload.stripePricePro = stripePricePro.trim();
    if (stripePriceCreditsPack.trim()) {
      payload.stripePriceCreditsPack = stripePriceCreditsPack.trim();
    }
    if (paystackPlanCodePlus.trim()) {
      payload.paystackPlanCodePlus = paystackPlanCodePlus.trim();
    }
    if (paystackPlanCodePro.trim()) {
      payload.paystackPlanCodePro = paystackPlanCodePro.trim();
    }

    const res = await fetch("/api/admin/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => null)) as
      | ErrorPayload
      | null;
    if (!res.ok) {
      setError(toErrorMessage(json?.error, "Could not save pricing."));
      setSaving(false);
      return;
    }
    setMessage(json?.changed ? "Pricing saved." : "No changes.");
    await load();
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="glass-panel flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading pricing configuration...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="glass-panel p-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Pricing & billing</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Configure plan prices, Paystack plans, allowances, and credits pack size.
        </p>
        {error ? <p className="mt-3 text-sm text-amber-200">{error}</p> : null}
        {message ? <p className="mt-3 text-sm text-emerald-200">{message}</p> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass-panel space-y-4 p-5">
          <h2 className="font-display text-xl font-semibold">Stripe</h2>
          <p className="text-sm text-muted-foreground">
            Configure Stripe price IDs used for Plus, Pro, and credits checkout.
          </p>
          <div className="space-y-3">
            <Input
              value={stripePricePlus}
              onChange={(e) => setStripePricePlus(e.target.value)}
              placeholder="Stripe Plus price id"
            />
            <Input
              value={stripePricePro}
              onChange={(e) => setStripePricePro(e.target.value)}
              placeholder="Stripe Pro price id"
            />
            <Input
              value={stripePriceCreditsPack}
              onChange={(e) => setStripePriceCreditsPack(e.target.value)}
              placeholder="Stripe credits pack price id"
            />
          </div>
        </div>

        <div className="glass-panel space-y-4 p-5">
          <h2 className="font-display text-xl font-semibold">Paystack</h2>
          <p className="text-sm text-muted-foreground">
            Configure Paystack plan codes and one-time credits amount (minor units).
          </p>
          <div className="space-y-3">
            <Input
              value={paystackPlanCodePlus}
              onChange={(e) => setPaystackPlanCodePlus(e.target.value)}
              placeholder="Paystack Plus plan code"
            />
            <Input
              value={paystackPlanCodePro}
              onChange={(e) => setPaystackPlanCodePro(e.target.value)}
              placeholder="Paystack Pro plan code"
            />
            <Input
              value={paystackAmountCreditsMinor}
              onChange={(e) => setPaystackAmountCreditsMinor(e.target.value)}
              placeholder="Paystack credits amount (minor)"
            />
          </div>
        </div>
      </div>

      <div className="glass-panel space-y-4 p-5">
        <h2 className="font-display text-xl font-semibold">Plan allowances</h2>
        <p className="text-sm text-muted-foreground">
          Monthly AI allowances by plan and shared credits-pack size.
        </p>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="allowance-free">Free monthly AI</Label>
            <Input
              id="allowance-free"
              value={allowanceFree}
              onChange={(e) => setAllowanceFree(e.target.value)}
              placeholder="e.g. 35"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="allowance-plus">Plus monthly AI</Label>
            <Input
              id="allowance-plus"
              value={allowancePlus}
              onChange={(e) => setAllowancePlus(e.target.value)}
              placeholder="e.g. 200"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="allowance-pro">Pro monthly AI</Label>
            <Input
              id="allowance-pro"
              value={allowancePro}
              onChange={(e) => setAllowancePro(e.target.value)}
              placeholder="e.g. 600"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="credits-pack-size">Credits pack size</Label>
            <Input
              id="credits-pack-size"
              value={creditsPackSize}
              onChange={(e) => setCreditsPackSize(e.target.value)}
              placeholder="e.g. 50"
            />
          </div>
        </div>
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save pricing
        </Button>
      </div>
    </div>
  );
}

function isErrorPayload(value: ConfigResponse | ErrorPayload): value is ErrorPayload {
  return "error" in value;
}
