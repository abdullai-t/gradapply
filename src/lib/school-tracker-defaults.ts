export type RequiredMaterialItem = {
  id: string;
  label: string;
  done: boolean;
};

export type LetterRecommenderItem = {
  id: string;
  name: string;
  done: boolean;
};

const DEFAULT_MATERIAL_LABELS = [
  "Res/CV",
  "Personal Statement",
  "Writing Sample",
  "Transcripts",
] as const;

const DEFAULT_LETTER_SLOT_COUNT = 3;

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `trk-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function defaultRequiredMaterials(): RequiredMaterialItem[] {
  return DEFAULT_MATERIAL_LABELS.map((label) => ({
    id: newId(),
    label,
    done: false,
  }));
}

export function defaultLetterRecommenders(): LetterRecommenderItem[] {
  return Array.from({ length: DEFAULT_LETTER_SLOT_COUNT }, () => ({
    id: newId(),
    name: "",
    done: false,
  }));
}

function isMaterialItem(v: unknown): v is RequiredMaterialItem {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.label === "string" &&
    typeof o.done === "boolean"
  );
}

function isRecommenderItem(v: unknown): v is LetterRecommenderItem {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    typeof o.done === "boolean"
  );
}

/** Merge saved JSON with template defaults (preserves user edits, adds missing template rows). */
export function normalizeRequiredMaterials(
  raw: unknown,
): RequiredMaterialItem[] {
  const defaults = defaultRequiredMaterials();
  if (!Array.isArray(raw) || raw.length === 0) return defaults;

  const saved = raw.filter(isMaterialItem);
  if (saved.length === 0) return defaults;

  const byLabel = new Map(
    saved.map((m) => [m.label.trim().toLowerCase(), m]),
  );
  const merged: RequiredMaterialItem[] = [];

  for (const d of defaults) {
    const hit = byLabel.get(d.label.toLowerCase());
    if (hit) {
      merged.push(hit);
      byLabel.delete(d.label.toLowerCase());
    } else {
      merged.push(d);
    }
  }
  for (const extra of byLabel.values()) {
    merged.push(extra);
  }
  return merged;
}

export function normalizeLetterRecommenders(
  raw: unknown,
): LetterRecommenderItem[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return defaultLetterRecommenders();
  }
  const saved = raw.filter(isRecommenderItem);
  if (saved.length === 0) return defaultLetterRecommenders();
  return saved;
}

export function materialsProgress(materials: RequiredMaterialItem[]): {
  done: number;
  total: number;
} {
  const total = materials.length;
  const done = materials.filter((m) => m.done).length;
  return { done, total };
}

export function lettersProgress(recommenders: LetterRecommenderItem[]): {
  done: number;
  total: number;
} {
  const withNames = recommenders.filter((r) => r.name.trim().length > 0);
  const total = withNames.length;
  const done = withNames.filter((r) => r.done).length;
  return { done, total };
}

/** Mark Personal Statement done when SOP body is substantial. */
export function syncPersonalStatementFromSop(
  materials: RequiredMaterialItem[],
  sopBodyLength: number,
): RequiredMaterialItem[] {
  if (sopBodyLength < 80) return materials;
  return materials.map((m) =>
    m.label.trim().toLowerCase() === "personal statement"
      ? { ...m, done: true }
      : m,
  );
}

/** Build required-materials checklist from LLM labels; preserve `done` when labels match. */
export function materialsFromInferLabels(
  labels: string[],
  existing: RequiredMaterialItem[] = [],
): RequiredMaterialItem[] {
  const cleaned = labels
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && l.length <= 200);
  if (cleaned.length === 0) {
    return existing.length > 0 ? existing : defaultRequiredMaterials();
  }

  const doneByLabel = new Map(
    existing.map((m) => [m.label.trim().toLowerCase(), m.done]),
  );
  const idByLabel = new Map(
    existing.map((m) => [m.label.trim().toLowerCase(), m.id]),
  );

  return cleaned.map((label) => {
    const key = label.toLowerCase();
    return {
      id: idByLabel.get(key) ?? newId(),
      label,
      done: doneByLabel.get(key) ?? false,
    };
  });
}

/** Resize recommender slots to program requirement; keep existing names when possible. */
export function recommendersFromInferCount(
  count: number | null | undefined,
  existing: LetterRecommenderItem[] = [],
): LetterRecommenderItem[] {
  const n =
    typeof count === "number" && Number.isFinite(count)
      ? Math.min(8, Math.max(0, Math.round(count)))
      : 0;
  if (n === 0) {
    return existing.length > 0 ? existing : defaultLetterRecommenders();
  }

  const out: LetterRecommenderItem[] = [];
  for (let i = 0; i < n; i++) {
    const prev = existing[i];
    out.push(
      prev ?? {
        id: newId(),
        name: "",
        done: false,
      },
    );
  }
  return out;
}

export function parseInferMaterialLabels(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseInferLettersRequired(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.min(8, Math.max(0, Math.round(raw)));
  }
  if (typeof raw === "string" && /^\d+$/.test(raw.trim())) {
    return Math.min(8, Math.max(0, parseInt(raw.trim(), 10)));
  }
  return null;
}
