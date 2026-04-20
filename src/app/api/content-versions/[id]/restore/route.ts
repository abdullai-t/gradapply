import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { parseProfEmailSnapshot } from "@/lib/prof-email-version";
import { prisma } from "@/lib/prisma";

/**
 * Applies a saved snapshot to the live draft. For professor email, updates
 * subject + body on the linked ProfEmail row.
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const version = await prisma.contentVersion.findFirst({
    where: { id: params.id, userId: session.user.id },
  });

  if (!version)
    return NextResponse.json({ error: "Version not found." }, { status: 404 });

  if (version.entityType === "PROF_EMAIL") {
    if (!version.entityId)
      return NextResponse.json(
        { error: "Version is missing entityId." },
        { status: 400 },
      );

    const snap = parseProfEmailSnapshot(version.body);
    if (!snap)
      return NextResponse.json(
        { error: "Could not parse email snapshot." },
        { status: 400 },
      );

    const prof = await prisma.profEmail.findFirst({
      where: { id: version.entityId, userId: session.user.id },
    });
    if (!prof)
      return NextResponse.json({ error: "Professor email not found." }, { status: 404 });

    const updated = await prisma.profEmail.update({
      where: { id: prof.id },
      data: {
        emailSubject: snap.emailSubject,
        emailBody: snap.emailBody,
      },
    });

    return NextResponse.json({ ok: true, profEmail: updated });
  }

  return NextResponse.json(
    {
      error:
        "Restore is only supported for professor email snapshots in this release. Re-upload files from the library for document history.",
    },
    { status: 400 },
  );
}
