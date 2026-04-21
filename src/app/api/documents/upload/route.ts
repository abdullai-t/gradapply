import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { requireNonFreeForFeature } from "@/lib/plan-gates";
import {
  isCloudinaryConfigured,
  uploadDocumentBuffer,
} from "@/lib/cloudinary";
import { prisma } from "@/lib/prisma";
import { isS3UploadConfigured, uploadObject } from "@/lib/s3";

const kindSchema = z.enum([
  "cv",
  "transcript",
  "gre",
  "sop_draft",
  "other",
]);

/**
 * Multipart upload: `file` + `kind` (cv | transcript | gre | sop_draft | other).
 * Uses Cloudinary when `CLOUDINARY_URL` is set; otherwise falls back to S3 `uploadObject`.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const locked = await requireNonFreeForFeature(session.user.id, "documents");
  if (locked) return locked;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  const kindRaw = form.get("kind");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const parsedKind = kindSchema.safeParse(
    typeof kindRaw === "string" ? kindRaw : "",
  );
  if (!parsedKind.success) {
    return NextResponse.json({ error: "Invalid document type" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const mimeType = file.type || "application/octet-stream";

  if (!isCloudinaryConfigured() && !isS3UploadConfigured()) {
    return NextResponse.json(
      {
        error:
          "No file storage configured. Add CLOUDINARY_URL to .env (or CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET), or set up S3 (bucket + AWS_REGION + AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY). Restart `pnpm dev` after editing .env.",
      },
      { status: 503 },
    );
  }

  try {
    let url: string;
    let storageKey: string | null;

    if (isCloudinaryConfigured()) {
      const { secure_url, public_id } = await uploadDocumentBuffer(buf, {
        folder: `gradapply/users/${session.user.id}`,
        filename: safeName,
      });
      url = secure_url;
      storageKey = public_id;
    } else {
      const key = `users/${session.user.id}/${randomUUID()}-${safeName}`;
      url = await uploadObject({
        key,
        body: buf,
        contentType: mimeType,
      });
      storageKey = key;
    }

    const doc = await prisma.document.create({
      data: {
        userId: session.user.id,
        name: file.name,
        type: parsedKind.data,
        url,
        s3Key: storageKey,
        mimeType,
        size: buf.length,
      },
    });
    return NextResponse.json(doc);
  } catch (e) {
    console.error(e);
    const msg =
      e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
