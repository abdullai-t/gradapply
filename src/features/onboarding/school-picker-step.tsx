"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signOutClient } from "@/lib/auth-client";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icon";
import { SealAvatar } from "@/components/seal-avatar";
import { useUpdateProfile } from "@/features/profile/api";
import { schoolsKeys } from "@/features/schools/api";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

import { TIER_SECTIONS, type RecommendedSchool } from "./types";

const LOADING_PHASES = [
  "Matching programs to your profile…",
  "Checking funding and fit…",
  "Building your shortlist…",
] as const;

function schoolKey(s: RecommendedSchool) {
  return `${s.name}::${s.program}::${s.degree}`;
}

function toCreatePayload(s: RecommendedSchool) {
  return {
    name: s.name,
    program: s.program,
    degree: s.degree,
    country: s.country || null,
    funding: s.funding?.trim() ? s.funding.trim() : null,
    notes: [s.whyFit, s.notes].filter(Boolean).join("\n\n"),
    portalUrl: s.portalUrl || null,
    status: "PLANNING" as const,
  };
}

export function OnboardingSchoolPickerStep() {
  const router = useRouter();
  const qc = useQueryClient();
  const updateProfile = useUpdateProfile();
  const [schools, setSchools] = useState<RecommendedSchool[]>([]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [loadPhase, setLoadPhase] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"add" | "skip" | null>(null);

  useEffect(() => {
    if (!loading) return;
    const id = window.setInterval(() => {
      setLoadPhase((p) => (p + 1) % LOADING_PHASES.length);
    }, 12000);
    return () => window.clearInterval(id);
  }, [loading]);

  const fetchRecommendations = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLoadPhase(0);
    try {
      const res = await fetch("/api/schools/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboarding: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Could not generate recommendations",
        );
      }
      const rows = Array.isArray(data.schools)
        ? (data.schools as RecommendedSchool[])
        : [];
      if (rows.length === 0) {
        throw new Error(
          "No schools matched your profile. Update your countries or research interests and try again.",
        );
      }
      setSchools(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load schools");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRecommendations();
  }, [fetchRecommendations]);

  const byTier = useMemo(() => {
    const map = new Map<string, RecommendedSchool[]>();
    for (const section of TIER_SECTIONS) {
      map.set(section.bucket, []);
    }
    for (const s of schools) {
      const bucket = s.tierBucket || "mid_tier";
      const list = map.get(bucket) ?? map.get("mid_tier")!;
      list.push(s);
    }
    return map;
  }, [schools]);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAllInTier = (bucket: string) => {
    const tierSchools = byTier.get(bucket) ?? [];
    setSelected((prev) => {
      const next = new Set(prev);
      for (const s of tierSchools) next.add(schoolKey(s));
      return next;
    });
  };

  const finishOnboarding = useCallback(async () => {
    setBusyAction("skip");
    setError(null);
    try {
      await updateProfile.mutateAsync({
        onboardingCompletedAt: new Date().toISOString(),
      });
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusyAction(null);
    }
  }, [router, updateProfile]);

  const addSelected = async () => {
    const picked = schools.filter((s) => selected.has(schoolKey(s)));
    setBusyAction("add");
    setError(null);
    try {
      if (picked.length > 0) {
        const res = await fetch("/api/schools/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schools: picked.map(toCreatePayload),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg =
            typeof data.error === "string"
              ? data.error
              : data.error?.message ?? "Could not add schools";
          throw new Error(msg);
        }
        await qc.invalidateQueries({ queryKey: schoolsKeys.all });
      }
      await updateProfile.mutateAsync({
        onboardingCompletedAt: new Date().toISOString(),
      });
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusyAction(null);
    }
  };

  const selectedCount = selected.size;

  if (loading) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[var(--primary-container)]/40">
          <Icon
            name="auto_awesome"
            className="animate-pulse text-[var(--primary)]"
            size={32}
          />
        </div>
        <div>
          <h2 className="t-headline-md m-0 text-[var(--on-surface)]">
            Building your shortlist
          </h2>
          <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
            {LOADING_PHASES[loadPhase]}
          </p>
          <p className="mt-1 text-xs text-[var(--outline)]">
            This usually takes 10–20 seconds.
          </p>
        </div>
      </div>
    );
  }

  if (error && schools.length === 0) {
    return (
      <div className="space-y-4">
        <div className="glass-alert-error text-sm" role="alert">
          {error}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={() => void fetchRecommendations()}>
            Try again
          </Button>
          <Button
            type="button"
            variant="secondary"
            loading={busyAction === "skip"}
            disabled={busyAction !== null}
            onClick={() => void finishOnboarding()}
          >
            Skip for now
          </Button>
        </div>
      </div>
    );
  }

  const isBusy = busyAction !== null;

  return (
    <div className="relative space-y-6">
      {isBusy ? (
        <div
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-[var(--surface)]/60 backdrop-blur-[2px]"
          aria-live="polite"
          aria-busy="true"
        >
          <p className="text-sm font-semibold text-[var(--on-surface)]">
            {busyAction === "skip"
              ? "Skipping to your dashboard…"
              : "Adding schools to your list…"}
          </p>
        </div>
      ) : null}
      <div>
        <h2 className="t-headline-md m-0 text-[var(--on-surface)]">
          Pick programs to track
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--on-surface-variant)]">
          We picked 5 programs matched to your profile. Select any you want on
          your list — you can add more later.
        </p>
      </div>

      {error ? (
        <div className="glass-alert-error text-sm" role="alert">
          {error}
        </div>
      ) : null}

      <div className="space-y-8">
        {TIER_SECTIONS.map((section) => {
          const tierSchools = byTier.get(section.bucket) ?? [];
          if (tierSchools.length === 0) return null;
          return (
            <section key={section.bucket} className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h3 className="m-0 text-lg font-bold text-[var(--on-surface)]">
                    {section.title}{" "}
                    <span className="text-sm font-semibold text-[var(--outline)]">
                      ({tierSchools.length})
                    </span>
                  </h3>
                  <p className="m-0 text-xs text-[var(--on-surface-variant)]">
                    {section.subtitle}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => selectAllInTier(section.bucket)}
                >
                  Select all in tier
                </Button>
              </div>
              <ul className="m-0 grid list-none gap-3 p-0">
                {tierSchools.map((s) => {
                  const key = schoolKey(s);
                  const checked = selected.has(key);
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        onClick={() => toggle(key)}
                        className={cn(
                          "tactile-card flex w-full gap-4 rounded-2xl border-2 p-4 text-left transition-colors",
                          checked
                            ? "border-[var(--primary)] bg-[var(--primary-container)]/15"
                            : "border-[var(--outline-variant)] hover:border-[var(--outline)]",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-1 grid h-5 w-5 shrink-0 place-items-center rounded border-2",
                            checked
                              ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                              : "border-[var(--outline-variant)]",
                          )}
                          aria-hidden
                        >
                          {checked ? (
                            <Icon name="check" size={14} />
                          ) : null}
                        </span>
                        <SealAvatar name={s.name} size={48} />
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-[var(--on-surface)]">
                            {s.name}
                          </div>
                          <div className="text-sm text-[var(--on-surface-variant)]">
                            {s.program} · {s.degree}
                            {s.country ? ` · ${s.country}` : ""}
                          </div>
                          {s.whyFit ? (
                            <p className="m-0 mt-2 text-sm leading-relaxed text-[var(--on-surface)]">
                              {s.whyFit}
                            </p>
                          ) : null}
                          {s.funding ? (
                            <p className="m-0 mt-1 text-xs font-semibold text-[var(--tertiary)]">
                              {s.funding}
                            </p>
                          ) : null}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <div className="sticky bottom-0 z-10 -mx-1 flex flex-col gap-3 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4 shadow-lg sm:flex-row sm:items-center sm:justify-between">
        <p className="m-0 text-sm font-semibold text-[var(--on-surface-variant)]">
          {selectedCount === 0
            ? "No schools selected"
            : `${selectedCount} selected`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={isBusy}
            loading={busyAction === "skip"}
            onClick={() => void finishOnboarding()}
          >
            Skip for now
          </Button>
          <Button
            type="button"
            icon="add"
            disabled={isBusy || selectedCount === 0}
            loading={busyAction === "add"}
            onClick={() => void addSelected()}
          >
            Add selected to my list
          </Button>
        </div>
      </div>
    </div>
  );
}

export function OnboardingSignOutLink() {
  return (
    <button
      type="button"
      onClick={() => void signOutClient().then(() => window.location.assign("/login"))}
      className="text-sm font-semibold text-[var(--on-surface-variant)] underline-offset-2 hover:underline"
    >
      Sign out
    </button>
  );
}
