"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Icon } from "@/components/icon";
import { useProfile, useUpdateProfile } from "@/features/profile/api";
import { COUNTRY_OPTIONS } from "@/lib/country-options";
import {
  DEGREE_OPTIONS,
  PROGRAM_OPTIONS,
  optionsWithFallback,
} from "@/lib/grad-options";
import { profileMeetsOnboardingMinimum } from "@/lib/onboarding";
const SELECT_NONE = "__none__";

export type ProfileStepForm = {
  targetDegree: string;
  focusArea: string;
  researchInterests: string;
  countriesOfInterest: string[];
  bio: string;
};

type Props = {
  onContinue: () => void;
};

export function OnboardingProfileStep({ onContinue }: Props) {
  const profileQuery = useProfile();
  const updateProfile = useUpdateProfile();
  const [form, setForm] = useState<ProfileStepForm>({
    targetDegree: "",
    focusArea: "",
    researchInterests: "",
    countriesOfInterest: [],
    bio: "",
  });
  const [countryDraft, setCountryDraft] = useState(SELECT_NONE);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (hydrated || !profileQuery.data) return;
    const p = profileQuery.data;
    setForm({
      targetDegree: (p.targetDegree as string) ?? "",
      focusArea: (p.focusArea as string) ?? "",
      researchInterests: (p.researchInterests as string) ?? "",
      countriesOfInterest: Array.isArray(p.countriesOfInterest)
        ? (p.countriesOfInterest as string[])
        : [],
      bio: (p.bio as string) ?? "",
    });
    setHydrated(true);
  }, [hydrated, profileQuery.data]);

  const degreeOptions = useMemo(
    () => optionsWithFallback(DEGREE_OPTIONS, form.targetDegree),
    [form.targetDegree],
  );
  const focusOptions = useMemo(
    () => optionsWithFallback(PROGRAM_OPTIONS, form.focusArea),
    [form.focusArea],
  );
  const selectedCountries = useMemo(
    () => new Set(form.countriesOfInterest),
    [form.countriesOfInterest],
  );

  const addCountry = () => {
    if (countryDraft === SELECT_NONE) return;
    if (selectedCountries.has(countryDraft)) return;
    if (form.countriesOfInterest.length >= 5) return;
    setForm((f) => ({
      ...f,
      countriesOfInterest: [...f.countriesOfInterest, countryDraft],
    }));
    setCountryDraft(SELECT_NONE);
  };

  const submit = useCallback(async () => {
    setError(null);
    const draft = {
      targetDegree: form.targetDegree || null,
      researchInterests: form.researchInterests || null,
      countriesOfInterest: form.countriesOfInterest,
    };
    if (
      !profileMeetsOnboardingMinimum({
        ...draft,
        onboardingCompletedAt: null,
      })
    ) {
      setError(
        "Add your target degree, at least 20 characters of research interests, and one country.",
      );
      return;
    }
    try {
      await updateProfile.mutateAsync({
        targetDegree: form.targetDegree || null,
        focusArea: form.focusArea || null,
        researchInterests: form.researchInterests || null,
        countriesOfInterest: form.countriesOfInterest,
        bio: form.bio || null,
      });
      onContinue();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save profile");
    }
  }, [form, onContinue, updateProfile]);

  if (profileQuery.isLoading && !hydrated) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--outline-variant)] p-12 text-center text-sm text-[var(--on-surface-variant)]">
        Loading your profile…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="t-headline-md m-0 text-[var(--on-surface)]">
          Tell us about your goals
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--on-surface-variant)]">
          We use this to recommend 15 graduate programs — 5 reach, 5 match, and
          5 safety — tailored to you.
        </p>
      </div>

      <div className="tactile-card space-y-5 rounded-3xl border border-[var(--outline-variant)] p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Target degree *">
            <Select
              value={form.targetDegree || SELECT_NONE}
              onValueChange={(v) =>
                setForm((f) => ({
                  ...f,
                  targetDegree: v === SELECT_NONE ? "" : v,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select degree" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SELECT_NONE}>Select degree</SelectItem>
                {degreeOptions.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Program focus">
            <Select
              value={form.focusArea || SELECT_NONE}
              onValueChange={(v) =>
                setForm((f) => ({
                  ...f,
                  focusArea: v === SELECT_NONE ? "" : v,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="e.g. Computer Science" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SELECT_NONE}>Not specified</SelectItem>
                {focusOptions.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field label="Research interests *">
          <Textarea
            value={form.researchInterests}
            onChange={(e) =>
              setForm((f) => ({ ...f, researchInterests: e.target.value }))
            }
            placeholder="What questions and methods drive your graduate school plans? (at least a few sentences)"
            rows={4}
          />
        </Field>

        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--outline)]">
            Countries of interest * (up to 5)
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={countryDraft} onValueChange={setCountryDraft}>
              <SelectTrigger className="sm:flex-1">
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent className="max-h-[min(22rem,60vh)]">
                <SelectItem value={SELECT_NONE}>Choose a country</SelectItem>
                {COUNTRY_OPTIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="secondary" icon="add" onClick={addCountry}>
              Add
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {form.countriesOfInterest.map((c) => (
              <span
                key={c}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--secondary-container)]/40 bg-[var(--secondary-container)]/30 px-3 py-1 text-xs font-bold text-[var(--on-secondary-container)]"
              >
                {c}
                <button
                  type="button"
                  aria-label={`Remove ${c}`}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      countriesOfInterest: f.countriesOfInterest.filter(
                        (x) => x !== c,
                      ),
                    }))
                  }
                  className="grid h-4 w-4 place-items-center rounded-full hover:bg-black/10"
                >
                  <Icon name="close" size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>

        <Field label="Short bio (optional)">
          <Textarea
            value={form.bio}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            placeholder="A few sentences about your background and what you want next."
            rows={3}
          />
        </Field>
      </div>

      {error ? (
        <div className="glass-alert-error text-sm" role="alert">
          {error}
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button
          type="button"
          size="lg"
          iconRight="arrow_forward"
          loading={updateProfile.isPending}
          onClick={() => void submit()}
        >
          Continue to school picks
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--outline)]">
        {label}
      </Label>
      {children}
    </div>
  );
}
