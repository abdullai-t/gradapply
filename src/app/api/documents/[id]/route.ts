import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { destroyStoredAsset, isCloudinaryConfigured } from "@/lib/cloudinary";
import {
  deleteObject,
  getBucketName,
  isS3UploadConfigured,
} from "@/lib/s3";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;

  const existing = await prisma.document.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (existing.s3Key) {
    if (isCloudinaryConfigured()) {
      await destroyStoredAsset(existing.s3Key);
    } else if (isS3UploadConfigured() && getBucketName()) {
      try {
        await deleteObject(existing.s3Key);
      } catch (e) {
        console.error(e);
      }
    }
  }

  await prisma.document.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
