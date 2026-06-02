"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "@/hooks/use-auth";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Icon } from "@/components/icon";
import { AIEnhanceTextarea } from "@/components/ai-enhance-textarea";
import { useProfile, useUpdateProfile } from "@/features/profile/api";
import {
  DEGREE_OPTIONS,
  PROGRAM_OPTIONS,
  optionsWithFallback,
} from "@/lib/grad-options";
import { COUNTRY_OPTIONS } from "@/lib/country-options";
import {
  detectBrowserTimezone,
  TIMEZONE_OPTIONS,
} from "@/lib/timezone-options";

const SELECT_NONE = "__none__";

type ProfileForm = {
  targetDegree: string;
  focusArea: string;
  greScore: string;
  greVerbal: string;
  greQuant: string;
  greAWA: string;
  undergradSchool: string;
  undergradDegree: string;
  undergradGPA: string;
  yearsExperience: string;
  researchInterests: string;
  countriesOfInterest: string[];
  bio: string;
  timezone: string;
};

const empty: ProfileForm = {
  targetDegree: "",
  focusArea: "",
  greScore: "",
  greVerbal: "",
  greQuant: "",
  greAWA: "",
  undergradSchool: "",
  undergradDegree: "",
  undergradGPA: "",
  yearsExperience: "",
  researchInterests: "",
  countriesOfInterest: [],
  bio: "",
  timezone: "UTC",
};

export default function ProfilePage() {
  const { data: session } = useSession();
  const [form, setForm] = useState<ProfileForm>(empty);
  const [saved, setSaved] = useState(false);
  const [countryDraft, setCountryDraft] = useState(SELECT_NONE);

  const profileQuery = useProfile();
  const updateProfile = useUpdateProfile();

  const targetDegreeItems = useMemo(
    () => optionsWithFallback(DEGREE_OPTIONS, form.targetDegree),
    [form.targetDegree],
  );
  const focusItems = useMemo(
    () => optionsWithFallback(PROGRAM_OPTIONS, form.focusArea),
    [form.focusArea],
  );
  const selectedCountries = useMemo(
    () => new Set(form.countriesOfInterest),
    [form.countriesOfInterest],
  );

  // Hydrate the form from the cached query result. Runs once when the data
  // first arrives; later refetches won't clobber unsaved edits.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (hydrated || !profileQuery.data) return;
    const p = profileQuery.data as Record<string, unknown>;
    setForm({
      targetDegree: (p.targetDegree as string) ?? "",
      focusArea: (p.focusArea as string) ?? "",
      greScore: (p.greScore as string) ?? "",
      greVerbal: (p.greVerbal as number)?.toString() ?? "",
      greQuant: (p.greQuant as number)?.toString() ?? "",
      greAWA: (p.greAWA as number)?.toString() ?? "",
      undergradSchool: (p.undergradSchool as string) ?? "",
      undergradDegree: (p.undergradDegree as string) ?? "",
      undergradGPA: (p.undergradGPA as number)?.toString() ?? "",
      yearsExperience: (p.yearsExperience as string) ?? "",
      researchInterests: (p.researchInterests as string) ?? "",
      countriesOfInterest: Array.isArray(p.countriesOfInterest)
        ? (p.countriesOfInterest as string[])
        : [],
      bio: (p.bio as string) ?? "",
      timezone:
        typeof p.timezone === "string" && p.timezone.trim()
          ? (p.timezone as string)
          : detectBrowserTimezone(),
    });
    setHydrated(true);
  }, [hydrated, profileQuery.data]);

  const loading = profileQuery.isLoading;
  const saving = updateProfile.isPending;

  const save = useCallback(async () => {
    setSaved(false);
    await updateProfile.mutateAsync({
      targetDegree: form.targetDegree || null,
      focusArea: form.focusArea || null,
      greScore: form.greScore || null,
      greVerbal: form.greVerbal ? Number(form.greVerbal) : null,
      greQuant: form.greQuant ? Number(form.greQuant) : null,
      greAWA: form.greAWA ? Number(form.greAWA) : null,
      undergradSchool: form.undergradSchool || null,
      undergradDegree: form.undergradDegree || null,
      undergradGPA: form.undergradGPA ? Number(form.undergradGPA) : null,
      yearsExperience: form.yearsExperience || null,
      researchInterests: form.researchInterests || null,
      countriesOfInterest: form.countriesOfInterest,
      bio: form.bio || null,
      timezone: form.timezone || null,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 4000);
  }, [form, updateProfile]);

  const addCountryOfInterest = useCallback(() => {
    if (countryDraft === SELECT_NONE) return;
    if (selectedCountries.has(countryDraft)) return;
    if (form.countriesOfInterest.length >= 5) return;
    setForm({
      ...form,
      countriesOfInterest: [...form.countriesOfInterest, countryDraft],
    });
    setCountryDraft(SELECT_NONE);
  }, [countryDraft, form, selectedCountries]);

  const removeCountryOfInterest = useCallback(
    (country: string) => {
      setForm({
        ...form,
        countriesOfInterest: form.countriesOfInterest.filter(
          (c) => c !== country,
        ),
      });
    },
    [form],
  );

  const initials = computeInitials(session?.user?.name, session?.user?.email);
  const displayName = session?.user?.name || session?.user?.email || "Applicant";

  return (
    <div className="slide-in space-y-8 pb-8">
      {/* Header card with avatar */}
      <div className="tactile-card relative overflow-hidden rounded-3xl border-2 border-[var(--outline-variant)] p-7 md:p-8">
        <div
          className="absolute inset-x-0 top-0 h-1.5"
          style={{
            background:
              "linear-gradient(90deg, var(--primary-container), var(--secondary-container))",
          }}
        />
        <div className="flex flex-col items-start gap-7 md:flex-row md:items-center">
          <div
            className="grid h-28 w-28 place-items-center rounded-3xl border-4 border-white text-4xl font-extrabold tracking-tight text-[var(--primary)]"
            style={{
              background:
                "linear-gradient(135deg, var(--primary-fixed), var(--primary-fixed-dim))",
              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.1)",
            }}
          >
            {initials}
          </div>
          <div className="flex-1">
            <h1 className="t-headline-lg m-0 text-[var(--on-surface)]">
              {displayName}
            </h1>
            {form.targetDegree || form.focusArea ? (
              <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--primary)]">
                <Icon name="verified" fill size={16} />
                {[form.targetDegree, form.focusArea]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
            {form.bio?.trim() ? (
              <p className="mt-3 text-[15px] leading-relaxed text-[var(--on-surface-variant)]">
                {form.bio.trim()}
              </p>
            ) : (
              <p className="mt-3 text-sm italic text-[var(--outline)]">
                Add a bio below — the assistant uses it as context for every
                draft.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {form.undergradSchool ? (
                <ProfileChip icon="domain" label={form.undergradSchool} />
              ) : null}
              {form.undergradDegree ? (
                <ProfileChip icon="menu_book" label={form.undergradDegree} />
              ) : null}
              {form.yearsExperience ? (
                <ProfileChip icon="work" label={form.yearsExperience} />
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Subtitle */}
      <p className="text-[15px] text-[var(--on-surface-variant)]">
        This context powers professor email drafts and the AI assistant&apos;s
        system prompts.
      </p>

      {loading ? (
        <div className="rounded-2xl border-2 border-dashed border-[var(--outline-variant)] p-10 text-center text-sm text-[var(--on-surface-variant)]">
          Loading profile…
        </div>
      ) : (
        <>
          <Section
            title="Notifications"
            description="Deadline and reminder emails use your local calendar date."
            icon="notifications"
          >
            <div className="max-w-md">
              <Label className="text-sm font-bold text-[var(--on-surface)]">
                Time zone
              </Label>
              <Select
                value={form.timezone || "UTC"}
                onValueChange={(v) => setForm({ ...form, timezone: v })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select time zone" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                  {form.timezone &&
                  !TIMEZONE_OPTIONS.some((o) => o.value === form.timezone) ? (
                    <SelectItem value={form.timezone}>{form.timezone}</SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
              <p className="mt-2 text-xs text-[var(--on-surface-variant)]">
                We email you 30 days before a school deadline and on dates you
                set under &quot;Remind me on&quot; in the application tracker.
              </p>
            </div>
          </Section>

          {/* Section: Basics */}
          <Section
            title="Basics"
            description="Your target degree and focus shape every recommendation."
            icon="explore"
          >
            <div className="grid gap-5 md:grid-cols-2">
              <SelectField
                label="Target degree"
                value={form.targetDegree}
                onChange={(v) => setForm({ ...form, targetDegree: v })}
                options={targetDegreeItems}
              />
              <SelectField
                label="Focus area (program)"
                value={form.focusArea}
                onChange={(v) => setForm({ ...form, focusArea: v })}
                options={focusItems}
              />
              <Field
                label="Years of experience"
                value={form.yearsExperience}
                onChange={(v) => setForm({ ...form, yearsExperience: v })}
              />
              <Field
                label="GRE score (combined or label)"
                value={form.greScore}
                onChange={(v) => setForm({ ...form, greScore: v })}
              />
            </div>
          </Section>

          {/* Section: Academic stats */}
          <Section
            title="Academic stats"
            description="Test scores and undergraduate background."
            icon="analytics"
          >
            <div className="grid gap-5 md:grid-cols-3">
              <Field
                label="GRE verbal"
                value={form.greVerbal}
                onChange={(v) => setForm({ ...form, greVerbal: v })}
                type="number"
              />
              <Field
                label="GRE quant"
                value={form.greQuant}
                onChange={(v) => setForm({ ...form, greQuant: v })}
                type="number"
              />
              <Field
                label="GRE AWA"
                value={form.greAWA}
                onChange={(v) => setForm({ ...form, greAWA: v })}
                type="number"
              />
              <Field
                label="Undergrad school"
                value={form.undergradSchool}
                onChange={(v) => setForm({ ...form, undergradSchool: v })}
              />
              <Field
                label="Undergrad degree"
                value={form.undergradDegree}
                onChange={(v) => setForm({ ...form, undergradDegree: v })}
              />
              <Field
                label="Undergrad GPA"
                value={form.undergradGPA}
                onChange={(v) => setForm({ ...form, undergradGPA: v })}
                type="number"
              />
            </div>
          </Section>

          {/* Section: Research focus */}
          <Section
            title="Research focus"
            description="The assistant uses these to align outreach and SOPs."
            icon="biotech"
          >
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--outline)]">
                  Research interests
                </Label>
                <AIEnhanceTextarea
                  value={form.researchInterests}
                  onChange={(v) =>
                    setForm({ ...form, researchInterests: v })
                  }
                  placeholder="One or two sentences on the questions and methods that excite you most."
                  enhancePrompt="Enhance this research interests text for a graduate school application profile. Make it clear, concise, and academically professional while preserving the core ideas and the applicant's voice."
                />
              </div>
              <div className="space-y-3">
                <Label className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--outline)]">
                  Countries of interest (max 5)
                </Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Select value={countryDraft} onValueChange={setCountryDraft}>
                    <SelectTrigger className="sm:flex-1">
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[min(22rem,60vh)]">
                      <SelectItem value={SELECT_NONE}>
                        Choose a country
                      </SelectItem>
                      {COUNTRY_OPTIONS.map((country) => (
                        <SelectItem key={country} value={country}>
                          {country}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="secondary"
                    icon="add"
                    onClick={addCountryOfInterest}
                    disabled={
                      countryDraft === SELECT_NONE ||
                      form.countriesOfInterest.length >= 5 ||
                      selectedCountries.has(countryDraft)
                    }
                  >
                    Add
                  </Button>
                </div>
                <p className="text-xs text-[var(--outline)]">
                  School recommendations in the add-school modal will be
                  narrowed to these countries.
                </p>
                <div className="flex flex-wrap gap-2">
                  {form.countriesOfInterest.map((country) => (
                    <span
                      key={country}
                      className="inline-flex items-center gap-2 rounded-full bg-[var(--secondary-container)]/30 px-3 py-1.5 text-xs font-bold text-[var(--on-secondary-container)] border border-[var(--secondary-container)]/40"
                    >
                      {country}
                      <button
                        type="button"
                        aria-label={`Remove ${country}`}
                        onClick={() => removeCountryOfInterest(country)}
                        className="grid h-4 w-4 place-items-center rounded-full hover:bg-black/10"
                      >
                        <Icon name="close" size={12} />
                      </button>
                    </span>
                  ))}
                  {form.countriesOfInterest.length === 0 ? (
                    <p className="text-sm italic text-[var(--outline)]">
                      No countries selected yet.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </Section>

          {/* Section: Bio */}
          <Section
            title="Bio &amp; narrative notes"
            description="Personal context surfaced in AI prompts."
            icon="article"
          >
            <AIEnhanceTextarea
              className="min-h-[160px]"
              value={form.bio}
              onChange={(v) => setForm({ ...form, bio: v })}
              placeholder="Three sentences about who you are, what you're working on, and where you want to go next."
              enhancePrompt="Enhance this bio for a graduate school application profile. Make it compelling, clear, and professional while maintaining the applicant's authentic voice and personal story."
            />
          </Section>

          {/* Save bar */}
          <div className="sticky bottom-4 z-20 flex items-center justify-between gap-3 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4 [box-shadow:0_8px_24px_-8px_rgba(15,23,42,0.12)]">
            <div className="flex items-center gap-2 text-sm text-[var(--on-surface-variant)]">
              {saved ? (
                <span className="inline-flex items-center gap-1.5 text-[var(--tertiary)]">
                  <Icon name="check_circle" fill size={18} />
                  Saved successfully.
                </span>
              ) : (
                <span>Changes save when you tap Save.</span>
              )}
            </div>
            <Button
              size="lg"
              onClick={() => void save()}
              disabled={saving}
              loading={saving}
              icon={saving ? undefined : "save"}
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function Section({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-6 md:p-7">
      <header className="mb-5 flex items-start gap-3">
        <div
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
          style={{
            background: "rgba(0,98,157,0.08)",
            color: "var(--primary)",
          }}
        >
          <Icon name={icon} size={22} />
        </div>
        <div>
          <h2 className="m-0 text-lg font-bold tracking-tight text-[var(--on-surface)]">
            {title}
          </h2>
          <p className="m-0 mt-0.5 text-sm text-[var(--on-surface-variant)]">
            {description}
          </p>
        </div>
      </header>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--outline)]">
        {label}
      </Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--outline)]">
        {label}
      </Label>
      <Select
        value={value || SELECT_NONE}
        onValueChange={(v) => onChange(v === SELECT_NONE ? "" : v)}
      >
        <SelectTrigger>
          <SelectValue placeholder="Not specified" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SELECT_NONE}>Not specified</SelectItem>
          {options.map((d) => (
            <SelectItem key={d} value={d}>
              {d}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ProfileChip({ icon, label }: { icon: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-container)] px-3.5 py-1.5 text-xs font-bold text-[var(--on-surface-variant)]">
      <Icon name={icon} size={14} />
      {label}
    </span>
  );
}

function computeInitials(
  name: string | null | undefined,
  email: string | null | undefined,
): string {
  if (name?.trim()) {
    return name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }
  if (email?.trim()) {
    return email.slice(0, 2).toUpperCase();
  }
  return "?";
}
