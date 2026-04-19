import { NextResponse } from "next/server";
import { ConnectorProvider, EmailStatus } from "@prisma/client";

import { auth } from "@/auth";
import {
  buildPlainTextRfc822,
  ensureFreshGmailAccess,
  fetchGmailProfileEmail,
  gmailSendRawMessage,
  rfc822ToGmailRaw,
} from "@/lib/gmail-connector";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const row = await prisma.profEmail.findFirst({
    where: { id: params.id, userId: session.user.id },
  });
  if (!row)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const to = row.profEmail?.trim();
  if (!to) {
    return NextResponse.json(
      { error: "Add a professor email address before sending." },
      { status: 400 },
    );
  }

  const subject = row.emailSubject?.trim();
  const body = row.emailBody?.trim();
  if (!subject || !body) {
    return NextResponse.json(
      { error: "Subject and body are required." },
      { status: 400 },
    );
  }

  const conn = await prisma.connector.findUnique({
    where: {
      userId_provider: {
        userId: session.user.id,
        provider: ConnectorProvider.GMAIL,
      },
    },
  });
  if (!conn) {
    return NextResponse.json(
      {
        error:
          "Gmail is not connected. Open Settings → Connectors and link your mailbox.",
      },
      { status: 400 },
    );
  }

  try {
    const ensured = await ensureFreshGmailAccess(session.user.id);
    const accessToken = ensured.accessToken;
    let externalEmail = ensured.externalEmail;

    if (!externalEmail) {
      const addr = await fetchGmailProfileEmail(accessToken);
      if (addr) {
        externalEmail = addr;
        await prisma.connector.update({
          where: { id: conn.id },
          data: { externalEmail: addr },
        });
      }
    }

    if (!externalEmail) {
      return NextResponse.json(
        {
          error:
            "Could not determine your Gmail address. Reconnect Gmail in Settings.",
        },
        { status: 400 },
      );
    }

    const rfc822 = buildPlainTextRfc822({
      from: externalEmail,
      to,
      subject,
      body,
    });
    const raw = rfc822ToGmailRaw(rfc822);
    await gmailSendRawMessage(accessToken, raw);

    const updated = await prisma.profEmail.update({
      where: { id: row.id },
      data: {
        status: EmailStatus.SENT,
        sentAt: new Date(),
      },
    });

    return NextResponse.json(updated);
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Failed to send via Gmail.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
