"use client";

import { useEffect, useState } from "react";

import { Icon } from "@/components/icon";
import { useProfile } from "@/features/profile/api";
import { profileMeetsOnboardingMinimum } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

import { OnboardingProfileStep } from "./profile-step";
import {
  OnboardingSchoolPickerStep,
  OnboardingSignOutLink,
} from "./school-picker-step";

export function OnboardingWizard() {
  const profileQuery = useProfile();
  const [step, setStep] = useState<1 | 2>(1);
  const [stepInitialized, setStepInitialized] = useState(false);

  useEffect(() => {
    if (stepInitialized || !profileQuery.data) return;
    const p = profileQuery.data;
    if (
      profileMeetsOnboardingMinimum({
        targetDegree: (p.targetDegree as string) ?? null,
        researchInterests: (p.researchInterests as string) ?? null,
        countriesOfInterest: Array.isArray(p.countriesOfInterest)
          ? (p.countriesOfInterest as string[])
          : [],
        onboardingCompletedAt: (p.onboardingCompletedAt as string) ?? null,
      })
    ) {
      setStep(2);
    }
    setStepInitialized(true);
  }, [profileQuery.data, stepInitialized]);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-8 flex items-center justify-between gap-4">
        <StepIndicator current={step} />
        <OnboardingSignOutLink />
      </div>

      {step === 1 ? (
        <OnboardingProfileStep onContinue={() => setStep(2)} />
      ) : (
        <OnboardingSchoolPickerStep />
      )}
    </div>
  );
}

function StepIndicator({ current }: { current: 1 | 2 }) {
  const steps = [
    { n: 1, label: "Profile" },
    { n: 2, label: "Schools" },
  ] as const;
  return (
    <ol className="m-0 flex list-none items-center gap-2 p-0">
      {steps.map((s, i) => (
        <li key={s.n} className="flex items-center gap-2">
          {i > 0 ? (
            <span
              className="h-px w-6 bg-[var(--outline-variant)]"
              aria-hidden
            />
          ) : null}
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold",
              current === s.n
                ? "bg-[var(--primary-container)] text-[var(--on-primary-container)]"
                : current > s.n
                  ? "bg-[var(--tertiary-container)]/40 text-[var(--on-surface)]"
                  : "bg-[var(--surface-container)] text-[var(--outline)]",
            )}
          >
            {current > s.n ? (
              <Icon name="check" size={14} />
            ) : (
              <span>{s.n}</span>
            )}
            {s.label}
          </span>
        </li>
      ))}
    </ol>
  );
}
