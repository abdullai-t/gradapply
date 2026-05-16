import { format } from "date-fns";

/** Parse JSON body deadline: bare `YYYY-MM-DD`, ISO datetime, or null. */
export function parseDeadlineBody(raw: unknown): Date | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;

  const ymdOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (ymdOnly) {
    const y = Number(ymdOnly[1]);
    const mo = Number(ymdOnly[2]);
    const d = Number(ymdOnly[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0, 0));
  }

  const parsed = new Date(s);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

/**
 * School infer / AI may return a stale cycle (e.g. Dec 2024). Bump the calendar
 * date by whole years (UTC) until it is on or after today's UTC date, or null
 * if still invalid after several tries.
 */
export function coerceSchoolInferDeadlineToFuture(ymd: string | null): string | null {
  if (!ymd?.trim()) return null;
  const parsed = parseDeadlineBody(ymd.trim());
  if (!parsed) return null;

  const now = new Date();
  const todayY = now.getUTCFullYear();
  const todayM = now.getUTCMonth();
  const todayD = now.getUTCDate();

  const compareToToday = (cy: number, cm: number, cd: number): number => {
    if (cy !== todayY) return cy - todayY;
    if (cm !== todayM) return cm - todayM;
    return cd - todayD;
  };

  let y = parsed.getUTCFullYear();
  const month = parsed.getUTCMonth();
  const day = parsed.getUTCDate();

  for (let i = 0; i < 8; i++) {
    const candidate = new Date(Date.UTC(y, month, day, 12, 0, 0, 0));
    if (Number.isNaN(candidate.getTime())) return null;
    const cy = candidate.getUTCFullYear();
    const cm = candidate.getUTCMonth();
    const cd = candidate.getUTCDate();
    if (compareToToday(cy, cm, cd) >= 0) {
      return `${String(cy).padStart(4, "0")}-${String(cm + 1).padStart(2, "0")}-${String(cd).padStart(2, "0")}`;
    }
    y += 1;
  }
  return null;
}

/** Value for `<input type="date">` from a stored `Date` or ISO string. */
export function formatDeadlineDateInput(iso: string | Date | null | undefined): string {
  if (iso === null || iso === undefined) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "";
  return format(d, "yyyy-MM-dd");
}
