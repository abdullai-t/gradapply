"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Icon } from "@/components/icon";
import { useConfirm } from "@/components/confirm-dialog";
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
import { Textarea } from "@/components/ui/textarea";
import {
  fetchSchoolInfer,
  applySchoolInferResponse,
} from "@/lib/school-infer-patch";
import { formatDeadlineDateInput } from "@/lib/school-deadline";
import {
  lettersProgress,
  materialsProgress,
  type LetterRecommenderItem,
  type RequiredMaterialItem,
} from "@/lib/school-tracker-defaults";
import type { SchoolRow, SchoolStatus } from "@/features/schools/types";
import { SCHOOL_STATUSES } from "@/features/schools/types";

type Props = {
  school: SchoolRow;
  onPatch: (
    body: Partial<SchoolRow> & Record<string, unknown>,
  ) => void | Promise<unknown>;
  onInferSaved?: (school: SchoolRow) => void;
  /** True while a PATCH (material/letter/field save) is in flight. */
  patchPending?: boolean;
};

export function ApplicationTracker({
  school,
  onPatch,
  onInferSaved,
  patchPending = false,
}: Props) {
  const confirm = useConfirm();
  const [inferBusy, setInferBusy] = useState(false);
  const [inferError, setInferError] = useState<string | null>(null);
  const [removingMaterialId, setRemovingMaterialId] = useState<string | null>(
    null,
  );
  const [removingLetterId, setRemovingLetterId] = useState<string | null>(null);
  const materials = school.requiredMaterials ?? [];
  const letters = school.letterRecommenders ?? [];
  const matProg = materialsProgress(materials);
  const letterProg = lettersProgress(letters);

  const patchMaterials = (next: RequiredMaterialItem[]) => {
    onPatch({ requiredMaterials: next });
  };

  const patchLetters = (next: LetterRecommenderItem[]) => {
    onPatch({ letterRecommenders: next });
  };

  const removeMaterial = async (id: string) => {
    const material = materials.find((x) => x.id === id);
    const ok = await confirm({
      title: "Remove material?",
      description: material
        ? `"${material.label}" will be removed from your checklist.`
        : "This item will be removed from your checklist.",
      variant: "destructive",
      confirmLabel: "Remove",
    });
    if (!ok) return;
    setRemovingMaterialId(id);
    try {
      await onPatch({
        requiredMaterials: materials.filter((x) => x.id !== id),
      });
    } finally {
      setRemovingMaterialId(null);
    }
  };

  const removeLetter = async (id: string) => {
    const letter = letters.find((x) => x.id === id);
    const ok = await confirm({
      title: "Remove recommender?",
      description: letter?.name.trim()
        ? `${letter.name} will be removed from your letters list.`
        : "This recommender will be removed from your letters list.",
      variant: "destructive",
      confirmLabel: "Remove",
    });
    if (!ok) return;
    setRemovingLetterId(id);
    try {
      await onPatch({
        letterRecommenders: letters.filter((x) => x.id !== id),
      });
    } finally {
      setRemovingLetterId(null);
    }
  };

  const fetchRequirementsWithAi = async () => {
    setInferBusy(true);
    setInferError(null);
    try {
      const data = await fetchSchoolInfer({ schoolId: school.id });
      const saved = await applySchoolInferResponse({
        data,
        existing: school,
        onPatch,
        onSaved: onInferSaved,
      });
      if (!saved) {
        setInferError(
          "AI could not find confident requirements for this program. Try adding department/program names, then retry.",
        );
        return;
      }
    } catch (e) {
      setInferError(e instanceof Error ? e.message : "Could not fetch requirements");
    } finally {
      setInferBusy(false);
    }
  };

  return (
    <section className="tactile-card rounded-3xl border border-[var(--outline-variant)] overflow-hidden">
      <header className="border-b border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[var(--on-surface)]">
              Application tracker
            </h2>
            <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
              Program details, materials, and recommendation letters — aligned with
              your grad-school spreadsheet.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--primary-container)] px-2.5 py-1 text-xs font-bold text-[var(--on-primary-container)]">
              Materials {matProg.done}/{matProg.total}
            </span>
            {letterProg.total > 0 ? (
              <span className="rounded-full bg-[var(--secondary-container)] px-2.5 py-1 text-xs font-bold text-[var(--on-secondary-container)]">
                Letters {letterProg.done}/{letterProg.total}
              </span>
            ) : null}
            {patchPending ? (
              <Loader2
                className="h-4 w-4 animate-spin text-[var(--primary)]"
                aria-label="Saving changes"
              />
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 text-xs font-bold"
              icon="auto_awesome"
              disabled={inferBusy}
              onClick={() => void fetchRequirementsWithAi()}
            >
              {inferBusy ? "Researching…" : "Fetch requirements"}
            </Button>
          </div>
        </div>
        {inferError ? (
          <p className="mt-3 text-xs font-semibold text-[var(--error)]" role="alert">
            {inferError}
          </p>
        ) : null}
      </header>

      <div className="space-y-6 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <TrackerField label="Program name / focus">
            <Input
              defaultValue={school.program}
              key={`${school.id}-program-${school.program}`}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== school.program) onPatch({ program: v });
              }}
            />
          </TrackerField>
          <TrackerField label="Application status">
            <Select
              value={school.status}
              onValueChange={(v) => onPatch({ status: v as SchoolStatus })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCHOOL_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replaceAll("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TrackerField>
          <TrackerField label="Program link">
            <UrlInput
              value={school.programUrl}
              schoolId={school.id}
              fieldKey="programUrl"
              onPatch={onPatch}
            />
          </TrackerField>
          <TrackerField label="Application link">
            <UrlInput
              value={school.portalUrl}
              schoolId={school.id}
              fieldKey="portalUrl"
              onPatch={onPatch}
            />
          </TrackerField>
          <TrackerField label="Department">
            <Input
              defaultValue={school.department ?? ""}
              placeholder="e.g. Sociology"
              key={`${school.id}-dept-${school.department ?? ""}`}
              onBlur={(e) =>
                onPatch({ department: e.target.value.trim() || null })
              }
            />
          </TrackerField>
          <TrackerField label="College">
            <Input
              defaultValue={school.college ?? ""}
              placeholder="e.g. Social & Behavioral Sciences"
              key={`${school.id}-college-${school.college ?? ""}`}
              onBlur={(e) =>
                onPatch({ college: e.target.value.trim() || null })
              }
            />
          </TrackerField>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TrackerField label="Deadline">
            <Input
              type="date"
              key={`${school.id}-d-${school.deadline ?? "none"}`}
              defaultValue={formatDeadlineDateInput(school.deadline)}
              onBlur={(e) =>
                onPatch({ deadline: e.target.value || null })
              }
            />
          </TrackerField>
          <TrackerField label="Application fee">
            <Input
              defaultValue={school.applicationFee ?? ""}
              placeholder="e.g. $85"
              key={`${school.id}-fee-${school.applicationFee ?? ""}`}
              onBlur={(e) =>
                onPatch({ applicationFee: e.target.value.trim() || null })
              }
            />
          </TrackerField>
          <TrackerField label="Remind me on">
            <Input
              type="date"
              key={`${school.id}-ra-${school.reminderAt ?? "none"}`}
              defaultValue={formatDeadlineDateInput(school.reminderAt)}
              onBlur={(e) =>
                onPatch({ reminderAt: e.target.value || null })
              }
            />
          </TrackerField>
          <div className="sm:col-span-2">
            <TrackerField label="Reminder note">
              <Textarea
                defaultValue={school.reminderNote ?? ""}
                placeholder="e.g. Submit GRE scores"
                rows={2}
                key={`${school.id}-rn-${school.reminderNote ?? ""}`}
                onBlur={(e) =>
                  onPatch({ reminderNote: e.target.value.trim() || null })
                }
              />
            </TrackerField>
          </div>
          {(school.reminderAt || school.reminderNote?.trim()) ? (
            <div className="sm:col-span-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 border border-dashed border-[var(--outline-variant)] text-xs font-bold"
                icon="notifications_off"
                onClick={() =>
                  onPatch({ reminderAt: null, reminderNote: null })
                }
              >
                Clear reminder
              </Button>
            </div>
          ) : null}
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-[var(--on-surface)]">
              Required materials
            </h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs font-bold"
              icon="add"
              onClick={() =>
                patchMaterials([
                  ...materials,
                  {
                    id: `m-${Date.now()}`,
                    label: "New item",
                    done: false,
                  },
                ])
              }
            >
              Add material
            </Button>
          </div>
          <ul className="space-y-2">
            {materials.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2"
              >
                <input
                  type="checkbox"
                  checked={m.done}
                  className="h-4 w-4 shrink-0 rounded border-[var(--outline)] accent-[var(--primary)]"
                  onChange={(e) =>
                    patchMaterials(
                      materials.map((x) =>
                        x.id === m.id ? { ...x, done: e.target.checked } : x,
                      ),
                    )
                  }
                  aria-label={`Mark ${m.label} done`}
                />
                <Input
                  defaultValue={m.label}
                  className="h-8 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
                  onBlur={(e) => {
                    const label = e.target.value.trim();
                    if (!label) return;
                    patchMaterials(
                      materials.map((x) =>
                        x.id === m.id ? { ...x, label } : x,
                      ),
                    );
                  }}
                />
                <button
                  type="button"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--outline)] hover:bg-[var(--error-container)] hover:text-[var(--error)] disabled:opacity-50"
                  aria-label={`Remove ${m.label}`}
                  disabled={removingMaterialId === m.id}
                  onClick={() => void removeMaterial(m.id)}
                >
                  {removingMaterialId === m.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Icon name="close" size={16} />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-[var(--on-surface)]">
              Letters of recommendation
            </h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs font-bold"
              icon="add"
              onClick={() =>
                patchLetters([
                  ...letters,
                  { id: `l-${Date.now()}`, name: "", done: false },
                ])
              }
            >
              Add recommender
            </Button>
          </div>
          <ul className="space-y-2">
            {letters.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2"
              >
                <input
                  type="checkbox"
                  checked={r.done}
                  disabled={!r.name.trim()}
                  className="h-4 w-4 shrink-0 rounded border-[var(--outline)] accent-[var(--primary)] disabled:opacity-40"
                  onChange={(e) =>
                    patchLetters(
                      letters.map((x) =>
                        x.id === r.id ? { ...x, done: e.target.checked } : x,
                      ),
                    )
                  }
                  aria-label={`Letter from ${r.name || "recommender"} submitted`}
                />
                <Input
                  defaultValue={r.name}
                  placeholder="Recommender name"
                  className="h-8 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
                  onBlur={(e) => {
                    const name = e.target.value.trim();
                    patchLetters(
                      letters.map((x) =>
                        x.id === r.id ? { ...x, name } : x,
                      ),
                    );
                  }}
                />
                <button
                  type="button"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--outline)] hover:bg-[var(--error-container)] hover:text-[var(--error)] disabled:opacity-50"
                  aria-label="Remove recommender"
                  disabled={removingLetterId === r.id}
                  onClick={() => void removeLetter(r.id)}
                >
                  {removingLetterId === r.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Icon name="close" size={16} />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <TrackerField label="Notes">
          <Textarea
            defaultValue={school.notes ?? ""}
            placeholder="Funding notes, dual-degree options, etc."
            rows={3}
            key={`${school.id}-tracker-notes-${school.notes ?? ""}`}
            onBlur={(e) => onPatch({ notes: e.target.value })}
          />
        </TrackerField>

        {(school.programUrl || school.portalUrl) && (
          <div className="flex flex-wrap gap-2 border-t border-[var(--outline-variant)] pt-4">
            {school.programUrl?.trim() ? (
              <Button variant="outline" size="sm" asChild>
                <Link
                  href={school.programUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="open_in_new" size={14} />
                  Program page
                </Link>
              </Button>
            ) : null}
            {school.portalUrl?.trim() ? (
              <Button variant="outline" size="sm" asChild>
                <Link
                  href={school.portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="open_in_new" size={14} />
                  Application portal
                </Link>
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

function TrackerField({
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

function UrlInput({
  value,
  schoolId,
  fieldKey,
  onPatch,
}: {
  value: string | null;
  schoolId: string;
  fieldKey: "programUrl" | "portalUrl";
  onPatch: Props["onPatch"];
}) {
  return (
    <Input
      type="url"
      defaultValue={value ?? ""}
      placeholder="https://..."
      key={`${schoolId}-${fieldKey}-${value ?? ""}`}
      onBlur={(e) =>
        onPatch({ [fieldKey]: e.target.value.trim() || null })
      }
    />
  );
}
