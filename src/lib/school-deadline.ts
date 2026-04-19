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

/** Value for `<input type="date">` from a stored `Date` or ISO string. */
export function formatDeadlineDateInput(iso: string | Date | null | undefined): string {
  if (iso === null || iso === undefined) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "";
  return format(d, "yyyy-MM-dd");
}
