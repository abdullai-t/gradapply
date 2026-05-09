// @ts-nocheck


import { runTask } from "@/lib/agents";
import {
  billingPrecheckResponse,
  finalizeAiConsumption,
} from "@/lib/billing-allowance";
import { formatLlmFailureMessage } from "@/lib/llm-errors";
import { requirePlusForFeature } from "@/lib/plan-gates";
import {
  assertProfEmailLlmAllowed,
  markProfEmailLlmAttempt,
  markProfEmailLlmSuccess,
  type ProfEmailLlmDenial,
} from "@/lib/prof-email-llm-rate-limit";
import { prisma } from "@/lib/prisma";

import { bad, ok } from "../_responses";
import { withAuth } from "../_with-auth";

import { sanitizeField } from "@/lib/agents/sanitize";
import { discoverBySchoolsBodySchema } from "./schemas";

export const discoverBySchools = withAuth(async (req, { userId }) => {
  const plusOnly = await requirePlusForFeature(
    userId,
    "school_specific_suggestions",
  );
  if (plusOnly) return plusOnly;

  const json = await req.json().catch(() => null);
  const parsed = discoverBySchoolsBodySchema.safeParse(json);
  if (!parsed.success) return bad(parsed.error.flatten());

  const quota = await billingPrecheckResponse(userId);
  if (quota) return quota;

  try {
    await assertProfEmailLlmAllowed(userId);
  } catch (e) {
    const denial = (e as Error & { denial?: ProfEmailLlmDenial }).denial;
    if (denial) {
      const headers: Record<string, string> = {};
      if (denial.retryAfterSec != null)
        headers.RetryAfter = String(denial.retryAfterSec);
      return Response.json(
        { error: denial.message },
        { status: denial.status, headers },
      );
    }
    throw e;
  }

  await markProfEmailLlmAttempt(userId);

  const uniqueIds = Array.from(new Set(parsed.data.schoolIds));

  const schools = await prisma.school.findMany({
    where: { userId, id: { in: uniqueIds } },
  });

  if (schools.length !== uniqueIds.length)
    return bad("One or more school ids are invalid.");

  try {
    const schoolSummary = schools
      .map(
        (s) =>
          `- [id:${s.id}] ${sanitizeField(s.name)} (${sanitizeField(s.program) || "N/A"}, ${sanitizeField(s.degree) || "N/A"}, ${sanitizeField(s.country) || "N/A"})`,
      )
      .join("\n");
    // Ask the model for explicit, normalised fields and require it to echo
    // the school id back so we can re-attach the school context client-side
    // without a second pass of fuzzy name matching.
    const message = [
      `Discover research-aligned faculty from these school programs based on my profile.`,
      `\nSchools:\n${schoolSummary}`,
      `\nReturn ONLY JSON in this exact shape (no prose, no fences):`,
      `{ "candidates": [{ "schoolId": "<echo the [id:..] of the school>", "profName": "<full name>", "university": "<school name>", "department": "<dept>", "researchArea": "<short summary>", "matchScore": 1-5, "rationale": "<one sentence>", "profileUrl": "<url or null>", "email": "<email or null>" }] }`,
    ].join("\n");

    const result = await runTask("faculty-discovery", message, userId);

    await Promise.all([
      finalizeAiConsumption(userId),
      markProfEmailLlmSuccess(userId),
    ]);

    const raw = result.reply.trim();
    // The model often wraps the JSON in a ```json fenced block — sometimes
    // the closing fence is missing if the response hits a length limit, so
    // we try a few strategies before giving up:
    //   1. Find a complete fenced block
    //   2. Strip leading "```json" / "```" prefix and trailing fence
    //   3. Fall back to the raw text
    // Then we attempt to repair common truncation issues by walking back to
    // the last balanced "}" so a partial array still parses.
    const tryParse = (s: string): { candidates?: unknown } | null => {
      try {
        return JSON.parse(s);
      } catch {
        return null;
      }
    };
    const fenced = raw.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
    const stripped = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "");
    let parsedJson: { candidates?: unknown } | null =
      (fenced && tryParse(fenced[1])) || tryParse(stripped) || tryParse(raw);

    // If JSON.parse failed (likely a truncated response), salvage what we can
    // by trimming back to the last complete object inside the candidates array.
    if (!parsedJson) {
      const arrMatch = stripped.match(/"candidates"\s*:\s*\[([\s\S]*)/);
      if (arrMatch) {
        const body = arrMatch[1];
        const lastClose = body.lastIndexOf("}");
        if (lastClose > 0) {
          const repaired = `{"candidates":[${body.slice(0, lastClose + 1)}]}`;
          parsedJson = tryParse(repaired);
        }
      }
    }
    if (!parsedJson) parsedJson = { candidates: [] };

    if (process.env.NODE_ENV !== "production") {
      const count = Array.isArray(parsedJson.candidates)
        ? (parsedJson.candidates as unknown[]).length
        : 0;
      console.info("[discover-by-schools] parsed candidates:", count);
    }

    // Normalise field names to the shape the client component renders. The
    // model is instructed to use { profName, email, schoolId } but we expose
    // { name, profEmail, schoolId, targetSchoolLabel, source } downstream
    // because that's the contract the page's DiscoveryCand type depends on.
    // Without this remap the suggestions list shows a "—" instead of the
    // professor's name and the school chip never resolves.
    const knownSchoolIds = new Set(schools.map((s) => s.id));
    const rawCandidates = Array.isArray(parsedJson.candidates)
      ? (parsedJson.candidates as Array<Record<string, unknown>>)
      : [];
    const candidates = rawCandidates.map((c) => {
      const profName =
        (typeof c.profName === "string" && c.profName) ||
        (typeof c.name === "string" && c.name) ||
        "";
      const email =
        (typeof c.email === "string" && c.email) ||
        (typeof c.profEmail === "string" && c.profEmail) ||
        null;
      const schoolId =
        typeof c.schoolId === "string" && knownSchoolIds.has(c.schoolId)
          ? c.schoolId
          : undefined;
      const universityLabel =
        typeof c.university === "string" && c.university
          ? c.university
          : undefined;
      return {
        name: profName,
        profileUrl:
          typeof c.profileUrl === "string" && c.profileUrl ? c.profileUrl : null,
        profEmail: email,
        schoolId,
        targetSchoolLabel: universityLabel,
        matchScore:
          typeof c.matchScore === "number"
            ? Math.max(1, Math.min(5, Math.round(c.matchScore)))
            : 3,
        researchArea:
          typeof c.researchArea === "string" ? c.researchArea : "",
        rationale: typeof c.rationale === "string" ? c.rationale : "",
        source: "school_program" as const,
      };
    }).filter((c) => c.name.trim().length > 0);

    return ok({ candidates });
  } catch (e) {
    return bad(formatLlmFailureMessage(e), 500);
  }
});
