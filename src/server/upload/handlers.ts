import { presignPut } from "@/lib/s3";

import { bad, ok } from "../_responses";
import { withPlanGate } from "../_with-plan-gate";

import { presignBodySchema } from "./schemas";

export const presign = withPlanGate("documents", async (req, { userId }) => {
  if (!process.env.S3_BUCKET)
    return bad("Uploads are not configured (missing S3_BUCKET).", 503);

  const json = await req.json().catch(() => null);
  const parsed = presignBodySchema.safeParse(json);
  if (!parsed.success) return bad(parsed.error.flatten());

  try {
    const result = await presignPut({
      userId,
      filename: parsed.data.filename,
      contentType: parsed.data.contentType,
    });

    if (!result.url)
      return bad(
        "Set PUBLIC_OBJECT_BASE_URL (or AWS region + bucket) so stored documents have a reachable URL.",
        503,
      );

    return ok(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not presign upload";
    return bad(msg, 500);
  }
});
