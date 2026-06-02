"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { CountryPicker } from "@/components/country-picker";
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
import { useProfile, useUpdateProfile } from "@/features/profile/api";
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
      setError("Add your target degree and at least one country of interest.");
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

        <Field label="Research interests (optional)">
          <Textarea
            value={form.researchInterests}
            onChange={(e) =>
              setForm((f) => ({ ...f, researchInterests: e.target.value }))
            }
            placeholder="What questions and methods drive your graduate school plans? (optional — improves recommendations)"
            rows={4}
          />
        </Field>

        <CountryPicker
          label="Countries of interest * (up to 5)"
          value={form.countriesOfInterest}
          onChange={(countriesOfInterest) =>
            setForm((f) => ({ ...f, countriesOfInterest }))
          }
          max={5}
          hint="Click a country in the list to add it. We use these for reach / match / safety recommendations."
        />

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
