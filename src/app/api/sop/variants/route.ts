import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import {
  billingPrecheckResponse,
  finalizeAiConsumption,
} from "@/lib/billing-allowance";
import { prisma } from "@/lib/prisma";
import { extractPlainTextFromStoredDocument } from "@/lib/llm-user-context";
import { formatLlmFailureMessage } from "@/lib/llm-errors";
import { generateTailoredSopBody } from "@/lib/sop-tailor-generate";
import {
  assertSopGenerateAllowed,
  markSopGenerateAttempt,
  markSopGenerateSuccess,
} from "@/lib/sop-generate-rate-limit";

const MASTER_TEXT_MAX = 30_000;

const postSchema = z
  .object({
    schoolId: z.string().min(1),
    masterDocumentId: z.string().optional(),
    masterText: z.string().optional(),
    title: z.string().min(1).max(200).optional(),
  })
  .refine(
    (d) =>
      Boolean(d.masterDocumentId?.trim()) ||
      (d.masterText?.trim().length ?? 0) >= 80,
    {
      message:
        "Provide masterDocumentId (library SOP) or masterText (at least 80 characters).",
    },
  )
  .refine(
    (d) => {
      const hasDoc = Boolean(d.masterDocumentId?.trim());
      const hasText = (d.masterText?.trim().length ?? 0) >= 80;
      return !(hasDoc && hasText);
    },
    {
      message:
        "Send only one of masterDocumentId or masterText (not both).",
    },
  )
  .refine(
    (d) => (d.masterText?.length ?? 0) <= MASTER_TEXT_MAX,
    { message: `masterText must be at most ${MASTER_TEXT_MAX} characters.` },
  );

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const schoolId = new URL(req.url).searchParams.get("schoolId");
  if (!schoolId?.trim())
    return NextResponse.json({ error: "schoolId required" }, { status: 400 });

  const school = await prisma.school.findFirst({
    where: { id: schoolId, userId: session.user.id },
  });
  if (!school) return NextResponse.json({ error: "School not found" }, { status: 404 });

  const variant = await prisma.sopVariant.findFirst({
    where: { schoolId, userId: session.user.id },
  });

  return NextResponse.json({ variant });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(json);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const school = await prisma.school.findFirst({
    where: { id: parsed.data.schoolId, userId: session.user.id },
  });
  if (!school) return NextResponse.json({ error: "School not found" }, { status: 404 });

  const quota = await billingPrecheckResponse(session.user.id);
  if (quota) return quota;

  try {
    await assertSopGenerateAllowed(session.user.id);
  } catch (e) {
    const denial = (e as Error & { denial?: { status: number; message: string; retryAfterSec?: number } })
      .denial;
    if (denial) {
      const headers: Record<string, string> = {};
      if (denial.retryAfterSec != null)
        headers.RetryAfter = String(denial.retryAfterSec);
      return NextResponse.json(
        { error: denial.message },
        { status: denial.status, headers },
      );
    }
    throw e;
  }

  await markSopGenerateAttempt(session.user.id);

  let masterSopText: string | null = null;
  let sourceMasterId: string | null = null;

  if (parsed.data.masterDocumentId?.trim()) {
    const doc = await prisma.document.findFirst({
      where: {
        id: parsed.data.masterDocumentId.trim(),
        userId: session.user.id,
        type: "sop_draft",
      },
    });
    if (!doc)
      return NextResponse.json(
        { error: "Master document not found or is not a statement-of-purpose draft." },
        { status: 400 },
      );
    masterSopText = await extractPlainTextFromStoredDocument(doc);
    if (!masterSopText)
      return NextResponse.json(
        {
          error:
            "Could not read text from that file (scan-only PDF, expired URL, or unsupported format). Paste plain text or upload a selectable PDF.",
        },
        { status: 400 },
      );
    sourceMasterId = doc.id;
  } else if (parsed.data.masterText?.trim()) {
    masterSopText = parsed.data.masterText.trim();
  }

  if (!masterSopText || masterSopText.length < 80)
    return NextResponse.json({ error: "Master SOP text is too short." }, { status: 400 });

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  });

  let bodyText: string;
  try {
    bodyText = await generateTailoredSopBody({
      masterSopText,
      school,
      profile,
    });
  } catch (e) {
    return NextResponse.json({ error: formatLlmFailureMessage(e) }, { status: 500 });
  }

  const title =
    parsed.data.title?.trim() || `${school.name} — tailored SOP`;

  const variant = await prisma.sopVariant.upsert({
    where: { schoolId: school.id },
    create: {
      userId: session.user.id,
      schoolId: school.id,
      title,
      body: bodyText.trim(),
      sourceMasterId,
    },
    update: {
      body: bodyText.trim(),
      sourceMasterId,
      ...(parsed.data.title?.trim()
        ? { title: parsed.data.title.trim() }
        : {}),
    },
  });

  await finalizeAiConsumption(session.user.id);
  await markSopGenerateSuccess(session.user.id);

  return NextResponse.json({ variant });
}
