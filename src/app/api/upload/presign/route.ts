import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { requireNonFreeForFeature } from "@/lib/plan-gates";
import { presignPut } from "@/lib/s3";
import { z } from "zod";

const bodySchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const locked = await requireNonFreeForFeature(session.user.id, "documents");
  if (locked) return locked;

  if (!process.env.S3_BUCKET)
    return NextResponse.json(
      { error: "Uploads are not configured (missing S3_BUCKET)." },
      { status: 503 },
    );

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const result = await presignPut({
      userId: session.user.id,
      filename: parsed.data.filename,
      contentType: parsed.data.contentType,
    });

    if (!result.url)
      return NextResponse.json(
        {
          error:
            "Set PUBLIC_OBJECT_BASE_URL (or AWS region + bucket) so stored documents have a reachable URL.",
        },
        { status: 503 },
      );

    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not presign upload";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
