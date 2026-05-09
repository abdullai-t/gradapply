// @ts-nocheck
/** Extract a readable message from `{ error }` bodies (string or Zod flattened form). */
export function messageFromApiErrorPayload(data: unknown): string {
  if (!data || typeof data !== "object") return "Request failed.";
  const err = (data as { error?: unknown }).error;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const f = err as {
      formErrors?: string[];
      fieldErrors?: Record<string, string[]>;
    };
    if (f.formErrors?.length) return f.formErrors.join("; ");
    const flat = Object.values(f.fieldErrors ?? {}).flat();
    if (flat.length) return flat.join("; ");
    try {
      return JSON.stringify(err);
    } catch {
      return "Request failed.";
    }
  }
  return "Request failed.";
}
