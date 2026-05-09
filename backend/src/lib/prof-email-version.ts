// @ts-nocheck
export type ProfEmailSnapshot = {
  emailSubject: string | null;
  emailBody: string | null;
};

export function serializeProfEmailSnapshot(s: ProfEmailSnapshot): string {
  return JSON.stringify({
    emailSubject: s.emailSubject ?? "",
    emailBody: s.emailBody ?? "",
  });
}

export function parseProfEmailSnapshot(
  body: string | null,
): ProfEmailSnapshot | null {
  if (body == null || body.trim() === "") return null;
  try {
    const j = JSON.parse(body) as unknown;
    if (!j || typeof j !== "object") return null;
    const o = j as Record<string, unknown>;
    return {
      emailSubject:
        typeof o.emailSubject === "string" ? o.emailSubject : null,
      emailBody: typeof o.emailBody === "string" ? o.emailBody : null,
    };
  } catch {
    return null;
  }
}

/** Canonical text for diffing professor email snapshots. */
export function profEmailSnapshotToText(s: ProfEmailSnapshot): string {
  const sub = s.emailSubject ?? "";
  const bod = s.emailBody ?? "";
  return `Subject\n${sub}\n\nBody\n${bod}`;
}
