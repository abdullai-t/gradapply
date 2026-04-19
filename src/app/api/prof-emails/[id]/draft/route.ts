import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { draftProfessorEmail } from "@/lib/ai";
import { fetchProfilePagePlainText } from "@/lib/profile-page-fetch";
import { extractProfessorAndDraftFromPage } from "@/lib/professor-from-url-ai";
import { formatLlmFailureMessage } from "@/lib/llm-errors";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;

  const row = await prisma.profEmail.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  });

  if (row.profileUrl?.trim()) {
    let fetched;
    try {
      fetched = await fetchProfilePagePlainText(row.profileUrl.trim());
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load profile page";
      return NextResponse.json({ error: msg }, { status: 422 });
    }

    try {
      const result = await extractProfessorAndDraftFromPage({
        profile,
        profilePageUrl: fetched.url,
        profilePageText: fetched.text,
        userId: session.user.id,
      });

      const updated = await prisma.profEmail.update({
        where: { id },
        data: {
          profName: result.profName,
          profEmail: result.profEmail,
          university: result.university,
          researchArea: result.researchArea,
          emailSubject: result.emailSubject,
          emailBody: result.emailBody,
          profileUrl: fetched.url,
        },
      });
      return NextResponse.json(updated);
    } catch (e) {
      return NextResponse.json(
        { error: formatLlmFailureMessage(e) },
        { status: 500 },
      );
    }
  }

  let draft;
  try {
    draft = await draftProfessorEmail({
      profile,
      profName: row.profName ?? "Professor",
      university: row.university ?? "",
      researchArea: row.researchArea,
      userNotes: row.notes,
      profilePageUrl: null,
      profilePageText: null,
      userId: session.user.id,
    });
  } catch (e) {
    return NextResponse.json(
      { error: formatLlmFailureMessage(e) },
      { status: 500 },
    );
  }

  const updated = await prisma.profEmail.update({
    where: { id },
    data: {
      emailSubject: draft.subject,
      emailBody: draft.body,
    },
  });

  return NextResponse.json(updated);
}
