/**
 * Parse JSON from LLM replies that may include markdown fences or leading prose.
 */
export function extractLlmJsonCandidate(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  return (fenced ? fenced[1] : trimmed).trim();
}

/**
 * Parse JSON from model text; tries whole string, then outer `{...}` or `[...]` slice.
 */
export function parseJsonFromLlmText(text: string): unknown {
  const candidate = extractLlmJsonCandidate(text);

  const tryParse = (s: string): unknown => JSON.parse(s);

  try {
    return tryParse(candidate);
  } catch {
    const startObj = candidate.indexOf("{");
    const endObj = candidate.lastIndexOf("}");
    if (startObj >= 0 && endObj > startObj) {
      try {
        return tryParse(candidate.slice(startObj, endObj + 1));
      } catch {
        /* continue */
      }
    }
    const startArr = candidate.indexOf("[");
    const endArr = candidate.lastIndexOf("]");
    if (startArr >= 0 && endArr > startArr) {
      try {
        return tryParse(candidate.slice(startArr, endArr + 1));
      } catch {
        /* continue */
      }
    }
  }

  throw new SyntaxError("Could not parse JSON from model output");
}

/** Normalize school recommend payloads whether the model returns `{ schools }` or a bare array. */
export function normalizeRecommendSchoolsPayload(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (
    parsed &&
    typeof parsed === "object" &&
    Array.isArray((parsed as { schools?: unknown }).schools)
  ) {
    return (parsed as { schools: unknown[] }).schools;
  }
  return [];
}
