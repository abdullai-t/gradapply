"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ConfigResponse = {
  settings: {
    paystackPlanCodePlus: string;
    paystackPlanCodePro: string;
    paystackAmountCreditsMinor: number;
    displayPriceProGhs: number;
    displayPricePlusGhs: number;
    creditUnitPriceGhs: number;
    allowanceFree: number;
    allowancePlus: number;
    allowancePro: number;
    freeSignupCredits: number;
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

  const [paystackPlanCodePlus, setPaystackPlanCodePlus] = useState("");
  const [paystackPlanCodePro, setPaystackPlanCodePro] = useState("");
  const [paystackAmountCreditsMinor, setPaystackAmountCreditsMinor] = useState("5000");
  const [displayPriceProGhs, setDisplayPriceProGhs] = useState("18");
  const [displayPricePlusGhs, setDisplayPricePlusGhs] = useState("35");
  const [creditUnitPriceGhs, setCreditUnitPriceGhs] = useState("1");
  const [allowanceFree, setAllowanceFree] = useState("35");
  const [allowancePlus, setAllowancePlus] = useState("200");
  const [allowancePro, setAllowancePro] = useState("600");
  const [freeSignupCredits, setFreeSignupCredits] = useState("10");

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
    setPaystackPlanCodePlus(json.settings.paystackPlanCodePlus);
    setPaystackPlanCodePro(json.settings.paystackPlanCodePro);
    setPaystackAmountCreditsMinor(String(json.settings.paystackAmountCreditsMinor));
    setDisplayPriceProGhs(String(json.settings.displayPriceProGhs));
    setDisplayPricePlusGhs(String(json.settings.displayPricePlusGhs));
    setCreditUnitPriceGhs(String(json.settings.creditUnitPriceGhs));
    setAllowanceFree(String(json.settings.allowanceFree));
    setAllowancePlus(String(json.settings.allowancePlus));
    setAllowancePro(String(json.settings.allowancePro));
    setFreeSignupCredits(String(json.settings.freeSignupCredits));
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
      displayPriceProGhs: Number(displayPriceProGhs || "0"),
      displayPricePlusGhs: Number(displayPricePlusGhs || "0"),
      creditUnitPriceGhs: Number(creditUnitPriceGhs || "0"),
      allowanceFree: Number(allowanceFree || "0"),
      allowancePlus: Number(allowancePlus || "0"),
      allowancePro: Number(allowancePro || "0"),
      freeSignupCredits: Number(freeSignupCredits || "0"),
    };
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
          Configure Paystack plan codes, checkout amounts, displayed prices, and allowances.
        </p>
        {error ? <p className="mt-3 text-sm text-amber-200">{error}</p> : null}
        {message ? <p className="mt-3 text-sm text-emerald-200">{message}</p> : null}
      </div>

      <div className="glass-panel space-y-4 p-5">
        <h2 className="font-display text-xl font-semibold">Paystack</h2>
        <p className="text-sm text-muted-foreground">
          Plan codes match recurring subscriptions from Paystack (used for renewals and
          webhook fulfillment). One-time plan checkout uses display prices below.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="plan-plus">Plus plan code</Label>
            <Input
              id="plan-plus"
              value={paystackPlanCodePlus}
              onChange={(e) => setPaystackPlanCodePlus(e.target.value)}
              placeholder="PLN_..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="plan-pro">Pro plan code</Label>
            <Input
              id="plan-pro"
              value={paystackPlanCodePro}
              onChange={(e) => setPaystackPlanCodePro(e.target.value)}
              placeholder="PLN_..."
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="credits-minor">Credits reference amount (minor units)</Label>
          <Input
            id="credits-minor"
            value={paystackAmountCreditsMinor}
            onChange={(e) => setPaystackAmountCreditsMinor(e.target.value)}
            placeholder="5000"
          />
          <p className="text-xs text-muted-foreground">
            Legacy field; per-credit checkout uses the credit unit price and pack size from
            server config.
          </p>
        </div>
      </div>

      <div className="glass-panel space-y-4 p-5">
        <h2 className="font-display text-xl font-semibold">Displayed prices (GHS)</h2>
        <p className="text-sm text-muted-foreground">
          These values are shown in user-facing pricing copy and billing screens.
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="display-price-pro">Pro price (GHS)</Label>
            <Input
              id="display-price-pro"
              value={displayPriceProGhs}
              onChange={(e) => setDisplayPriceProGhs(e.target.value)}
              placeholder="18"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="display-price-plus">Plus price (GHS)</Label>
            <Input
              id="display-price-plus"
              value={displayPricePlusGhs}
              onChange={(e) => setDisplayPricePlusGhs(e.target.value)}
              placeholder="35"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="credit-unit-price-ghs">1 credit price (GHS)</Label>
            <Input
              id="credit-unit-price-ghs"
              value={creditUnitPriceGhs}
              onChange={(e) => setCreditUnitPriceGhs(e.target.value)}
              placeholder="1"
            />
          </div>
        </div>
      </div>

      <div className="glass-panel space-y-4 p-5">
        <h2 className="font-display text-xl font-semibold">Plan allowances</h2>
        <p className="text-sm text-muted-foreground">
          Plan allowances per billing period (paid tiers) and one-time free signup credits.
        </p>
        <div className="grid gap-3 md:grid-cols-4">
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
            <Label htmlFor="free-signup-credits">
              Free signup credits (one-time, no renewal)
            </Label>
            <Input
              id="free-signup-credits"
              value={freeSignupCredits}
              onChange={(e) => setFreeSignupCredits(e.target.value)}
              placeholder="e.g. 10"
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
