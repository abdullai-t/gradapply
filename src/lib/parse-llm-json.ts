/**
 * Parse JSON from LLM replies that may include markdown fences or leading prose.
 */
export function extractLlmJsonCandidate(raw: string): string {
  let trimmed = raw.trim();
  if (trimmed.startsWith("```")) {
    trimmed = trimmed.replace(/^```(?:json)?\s*/i, "");
    const closeIdx = trimmed.indexOf("```");
    trimmed = closeIdx >= 0 ? trimmed.slice(0, closeIdx) : trimmed;
  }
  return trimmed.trim();
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

/** Pull complete `{...}` objects from a truncated `"schools": [...]` payload. */
export function salvageJsonObjectsFromArray(
  text: string,
  arrayKey: string,
): unknown[] {
  const keyPattern = `"${arrayKey}"`;
  const keyIdx = text.indexOf(keyPattern);
  if (keyIdx < 0) return [];

  const arrStart = text.indexOf("[", keyIdx);
  if (arrStart < 0) return [];

  const objects: unknown[] = [];
  let i = arrStart + 1;

  while (i < text.length) {
    while (i < text.length && text[i] !== "{") i++;
    if (i >= text.length) break;

    let depth = 0;
    let inString = false;
    let escape = false;
    const start = i;

    for (; i < text.length; i++) {
      const c = text[i];
      if (inString) {
        if (escape) escape = false;
        else if (c === "\\") escape = true;
        else if (c === '"') inString = false;
        continue;
      }
      if (c === '"') {
        inString = true;
        continue;
      }
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          try {
            objects.push(JSON.parse(text.slice(start, i + 1)));
          } catch {
            /* skip malformed object */
          }
          i++;
          break;
        }
      }
    }

    if (depth !== 0) break;
  }

  return objects;
}

/** Parse recommend JSON; salvages complete school rows when the model truncates. */
export function parseRecommendSchoolsFromLlmText(text: string): unknown[] {
  try {
    return normalizeRecommendSchoolsPayload(parseJsonFromLlmText(text));
  } catch {
    const candidate = extractLlmJsonCandidate(text);
    const salvaged = salvageJsonObjectsFromArray(candidate, "schools");
    if (salvaged.length > 0) return salvaged;
    throw new SyntaxError("Could not parse JSON from model output");
  }
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
