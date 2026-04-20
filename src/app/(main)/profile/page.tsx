"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEGREE_OPTIONS,
  PROGRAM_OPTIONS,
  optionsWithFallback,
} from "@/lib/grad-options";

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
  bio: string;
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
  bio: "",
};

export default function ProfilePage() {
  const [form, setForm] = useState<ProfileForm>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const targetDegreeItems = useMemo(
    () => optionsWithFallback(DEGREE_OPTIONS, form.targetDegree),
    [form.targetDegree],
  );
  const focusItems = useMemo(
    () => optionsWithFallback(PROGRAM_OPTIONS, form.focusArea),
    [form.focusArea],
  );

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/profile");
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const p = await res.json();
      setForm({
        targetDegree: p.targetDegree ?? "",
        focusArea: p.focusArea ?? "",
        greScore: p.greScore ?? "",
        greVerbal: p.greVerbal?.toString() ?? "",
        greQuant: p.greQuant?.toString() ?? "",
        greAWA: p.greAWA?.toString() ?? "",
        undergradSchool: p.undergradSchool ?? "",
        undergradDegree: p.undergradDegree ?? "",
        undergradGPA: p.undergradGPA?.toString() ?? "",
        yearsExperience: p.yearsExperience ?? "",
        researchInterests: p.researchInterests ?? "",
        bio: p.bio ?? "",
      });
      setLoading(false);
    };
    void load();
  }, []);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
        bio: form.bio || null,
      }),
    });
    setSaving(false);
    if (res.ok) setSaved(true);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Applicant profile</h1>
        <p className="text-muted-foreground">
          This context powers professor email drafts and the AI assistant’s system
          prompts.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Basics</CardTitle>
          <CardDescription>
            Degrees, focus areas, and experience summaries.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading profile…</div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Target degree</Label>
                  <Select
                    value={form.targetDegree ? form.targetDegree : SELECT_NONE}
                    onValueChange={(v) =>
                      setForm({
                        ...form,
                        targetDegree: v === SELECT_NONE ? "" : v,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Not specified" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SELECT_NONE}>Not specified</SelectItem>
                      {targetDegreeItems.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Focus area (program)</Label>
                  <Select
                    value={form.focusArea ? form.focusArea : SELECT_NONE}
                    onValueChange={(v) =>
                      setForm({
                        ...form,
                        focusArea: v === SELECT_NONE ? "" : v,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Not specified" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SELECT_NONE}>Not specified</SelectItem>
                      {focusItems.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
              <div className="space-y-2">
                <Label>Research interests</Label>
                <Textarea
                  value={form.researchInterests}
                  onChange={(e) =>
                    setForm({ ...form, researchInterests: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Bio / narrative notes</Label>
                <Textarea
                  className="min-h-[140px]"
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={() => void save()} disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </Button>
                {saved && (
                  <span className="text-sm text-emerald-600">Saved successfully.</span>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
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
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
