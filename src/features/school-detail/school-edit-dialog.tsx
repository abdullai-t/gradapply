"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SchoolDetailForm } from "@/features/schools/school-detail-form";
import { ApplicationTracker } from "./application-tracker";
import type { SchoolRow } from "@/features/schools/types";

type Props = {
  school: SchoolRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPatch: (body: Partial<SchoolRow> & Record<string, unknown>) => void;
};

/**
 * Modal editor for school application fields (status, deadline, notes, etc.).
 * Saves on blur / select change via the shared `SchoolDetailForm`.
 */
export function SchoolEditDialog({
  school,
  open,
  onOpenChange,
  onPatch,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,900px)] max-w-3xl gap-0 overflow-y-auto p-0">
        <DialogHeader className="border-b border-[var(--outline-variant)] px-6 py-5 text-left">
          <DialogTitle className="text-lg font-bold text-[var(--on-surface)]">
            Update school details
          </DialogTitle>
          <DialogDescription className="text-sm text-[var(--on-surface-variant)]">
            Changes save automatically when you leave a field or pick a new
            option. {school.name}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-8 px-6 py-5">
          <ApplicationTracker school={school} onPatch={onPatch} />
          <div className="border-t border-[var(--outline-variant)] pt-6">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.08em] text-[var(--outline)]">
              Timeline & reminders
            </p>
            <SchoolDetailForm
              school={school}
              onPatch={onPatch}
              showSopPromo={false}
              hideTrackerFields
              hideTimelineFields
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
