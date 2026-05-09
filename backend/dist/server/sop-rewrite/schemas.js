// @ts-nocheck
import { z } from "zod";
const ORIGINAL_MAX = 10_000;
const PROMPT_MAX = 1_000;
export const rewriteSelectionSchema = z.object({
    /// The exact text the user highlighted (or the whole document for a
    /// scope: "document" rewrite). The LLM rewrites only this — it never
    /// sees other paragraphs as targets.
    originalText: z.string().min(1).max(ORIGINAL_MAX),
    /// Free-text instruction: "tighten the opening", "make this less academic", etc.
    prompt: z.string().min(1).max(PROMPT_MAX),
    /// Optional: provides school context to the LLM (program, deadline, etc.).
    schoolId: z.string().min(1).optional(),
    /// "selection" = a highlighted span, "document" = the whole draft.
    /// Only affects the system-prompt framing; the API treats both the same.
    scope: z.enum(["selection", "document"]).default("selection"),
});
