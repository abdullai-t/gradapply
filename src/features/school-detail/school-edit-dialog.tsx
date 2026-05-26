"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SchoolDetailForm } from "@/features/schools/school-detail-form";
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
      <DialogContent className="max-h-[min(90vh,820px)] max-w-2xl gap-0 overflow-y-auto p-0">
        <DialogHeader className="border-b border-[var(--outline-variant)] px-6 py-5 text-left">
          <DialogTitle className="text-lg font-bold text-[var(--on-surface)]">
            Update school details
          </DialogTitle>
          <DialogDescription className="text-sm text-[var(--on-surface-variant)]">
            Changes save automatically when you leave a field or pick a new
            option. {school.name}
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 py-5">
          <SchoolDetailForm
            school={school}
            onPatch={onPatch}
            showSopPromo={false}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
