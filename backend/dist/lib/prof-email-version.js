export function serializeProfEmailSnapshot(s) {
    return JSON.stringify({
        emailSubject: s.emailSubject ?? "",
        emailBody: s.emailBody ?? "",
    });
}
export function parseProfEmailSnapshot(body) {
    if (body == null || body.trim() === "")
        return null;
    try {
        const j = JSON.parse(body);
        if (!j || typeof j !== "object")
            return null;
        const o = j;
        return {
            emailSubject: typeof o.emailSubject === "string" ? o.emailSubject : null,
            emailBody: typeof o.emailBody === "string" ? o.emailBody : null,
        };
    }
    catch {
        return null;
    }
}
/** Canonical text for diffing professor email snapshots. */
export function profEmailSnapshotToText(s) {
    const sub = s.emailSubject ?? "";
    const bod = s.emailBody ?? "";
    return `Subject\n${sub}\n\nBody\n${bod}`;
}
