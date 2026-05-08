"use client";

import Link from "next/link";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icon";
import {
  ADMISSION_TERM_OPTIONS,
  admissionTermLabel,
} from "@/lib/admission-term";
import { formatDeadlineDateInput } from "@/lib/school-deadline";

import type { SchoolRow, SchoolStatus } from "./types";
import { SCHOOL_STATUSES } from "./types";

const TERM_SELECT_NONE = "__term_none__";

export interface SchoolDetailFormProps {
  school: SchoolRow;
  onPatch: (body: Partial<SchoolRow> & Record<string, unknown>) => void;
}

/**
 * Inline edit form for a school. Same field set / handlers as v1 — every
 * change PATCHes via `onPatch`. Saves on `onBlur` for text fields, on change
 * for selects.
 */
export function SchoolDetailForm({
  school,
  onPatch,
}: SchoolDetailFormProps) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Admission term">
          <Select
            value={school.term ?? TERM_SELECT_NONE}
            onValueChange={(v) =>
              onPatch({
                term: v === TERM_SELECT_NONE ? null : (v as SchoolRow["term"]),
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Term" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TERM_SELECT_NONE}>Not specified</SelectItem>
              {ADMISSION_TERM_OPTIONS.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Status">
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
        </Field>

        <Field label="Country">
          <Input
            defaultValue={school.country ?? ""}
            placeholder="e.g. United States"
            key={`${school.id}-country-${school.country ?? ""}`}
            onBlur={(e) =>
              onPatch({
                country: e.target.value.trim() || null,
              })
            }
          />
        </Field>

        <Field label="Deadline">
          <Input
            type="date"
            key={`${school.id}-d-${school.deadline ?? "none"}`}
            defaultValue={formatDeadlineDateInput(school.deadline)}
            onBlur={(e) =>
              onPatch({ deadline: e.target.value || null })
            }
          />
        </Field>
      </div>

      <Field label="Funding notes">
        <Input
          defaultValue={school.funding ?? ""}
          placeholder="Funded? Stipend? Tuition waiver?"
          key={`${school.id}-f-${school.funding ?? ""}`}
          onBlur={(e) =>
            onPatch({ funding: e.target.value.trim() || null })
          }
        />
      </Field>

      <Field label="Portal URL">
        <Input
          type="url"
          defaultValue={school.portalUrl ?? ""}
          placeholder="https://..."
          key={`${school.id}-p-${school.portalUrl ?? ""}`}
          onBlur={(e) =>
            onPatch({ portalUrl: e.target.value.trim() || null })
          }
        />
      </Field>

      <Field label="Notes">
        <Textarea
          defaultValue={school.notes ?? ""}
          placeholder="Anything you want to remember about this school."
          key={`${school.id}-n-${school.notes ?? ""}`}
          onBlur={(e) => onPatch({ notes: e.target.value })}
        />
      </Field>

      <div className="rounded-2xl border border-[var(--primary-container)]/30 bg-[var(--primary-fixed)]/40 p-4 dark:border-[var(--primary-container)]/40 dark:bg-[var(--primary-container)]/10">
        <div className="text-sm font-bold text-[var(--on-surface)]">
          School-specific statement of purpose
        </div>
        <p className="mt-1 text-xs leading-relaxed text-[var(--on-surface-variant)]">
          Open the SOP studio to paste or upload your master, generate a
          tailored draft, and refine it via chat or rich-text editing.
        </p>
        <Link
          href={`/assistant?mode=sop&schoolId=${school.id}`}
          prefetch={false}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--secondary-container)] px-3 py-1.5 text-sm font-bold text-[var(--on-secondary-container)] transition-colors hover:bg-[var(--secondary-container)]/80"
        >
          <Icon name="auto_awesome" size={16} fill />
          Open SOP studio
        </Link>
      </div>

      <div className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4">
        <div className="text-sm font-bold text-[var(--on-surface)]">Reminder</div>
        <p className="mt-1 text-xs leading-relaxed text-[var(--on-surface-variant)]">
          Optional follow-up date — appears on Timeline and in the dashboard
          banner.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Remind me on">
            <Input
              type="date"
              key={`${school.id}-ra-${school.reminderAt ?? "none"}`}
              defaultValue={formatDeadlineDateInput(school.reminderAt)}
              onBlur={(e) =>
                onPatch({ reminderAt: e.target.value || null })
              }
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Reminder note">
              <Textarea
                key={`${school.id}-rn-${school.reminderNote ?? ""}`}
                defaultValue={school.reminderNote ?? ""}
                placeholder="e.g. Submit GRE scores"
                onBlur={(e) =>
                  onPatch({ reminderNote: e.target.value || null })
                }
              />
            </Field>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-3 border border-dashed border-[var(--outline-variant)]"
          icon="notifications_off"
          disabled={!school.reminderAt && !school.reminderNote?.trim()}
          onClick={() =>
            onPatch({ reminderAt: null, reminderNote: null })
          }
        >
          Clear reminder
        </Button>
      </div>

      {school.term ? (
        <p className="text-xs text-[var(--outline)]">
          Term selected: <strong>{admissionTermLabel(school.term)}</strong>
        </p>
      ) : null}
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
