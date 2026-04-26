import { z } from "zod";

import { SOP_VARIANT_BODY_MAX } from "../sop-variants/schemas";

export const scoreSopSchema = z.object({
  /// Plain-text body of the current draft. The client should send the rendered
  /// text from the editor (Tiptap.getText() or similar) — not the raw HTML.
  body: z.string().min(40).max(SOP_VARIANT_BODY_MAX),
  /// School this draft is being tailored to. Used for context-aware scoring
  /// (e.g. checklist items like "Why this school? specifics").
  schoolId: z.string().min(1).optional(),
});

export type ScoreSopRequest = z.infer<typeof scoreSopSchema>;

export type SopScoreResponse = {
  persuasiveness: number; // 0-100
  clarity: number; // 0-100
  tone: { label: string; active: boolean }[];
  checklist: { label: string; done: boolean }[];
};
