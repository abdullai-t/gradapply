import { NextResponse } from "next/server";
import { ConnectorProvider, EmailStatus } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/auth";
import {
  buildRfc822WithAttachments,
  ensureFreshGmailAccess,
  fetchGmailProfileEmail,
  type GmailAttachment,
  gmailSendRawMessage,
  rfc822ToGmailRaw,
} from "@/lib/gmail-connector";
import { requireNonFreeForFeature } from "@/lib/plan-gates";
import { prisma } from "@/lib/prisma";
import { getObjectBuffer } from "@/lib/s3";

const sendBodySchema = z.object({
  attachmentDocumentIds: z.array(z.string().min(1)).max(6).optional(),
});

const ALLOWED_ATTACHMENT_TYPES = new Set(["cv", "transcript", "gre"]);
const MAX_SINGLE_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 18 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 20_000;
const FETCH_HEADER_SETS: Record<string, string>[] = [
  {
    Accept: "*/*",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  },
  {
    Accept: "*/*",
    "User-Agent": "GradApply/1.0 (gmail attachment fetch)",
  },
];

async function fetchUrlBufferOnce(
  url: string,
  headers: Record<string, string>,
): Promise<{ buffer: Buffer | null; tooLarge: boolean }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers,
    });
    if (!res.ok) return { buffer: null, tooLarge: false };
    const len = res.headers.get("content-length");
    if (len && Number(len) > MAX_SINGLE_ATTACHMENT_BYTES) {
      return { buffer: null, tooLarge: true };
    }
    const ab = await res.arrayBuffer();
    if (ab.byteLength === 0 || ab.byteLength > MAX_SINGLE_ATTACHMENT_BYTES) {
      return { buffer: null, tooLarge: ab.byteLength > MAX_SINGLE_ATTACHMENT_BYTES };
    }
    return { buffer: Buffer.from(ab), tooLarge: false };
  } catch {
    return { buffer: null, tooLarge: false };
  } finally {
    clearTimeout(timer);
  }
}

function inferS3KeyFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const path = decodeURIComponent(u.pathname).replace(/^\/+/, "");
    if (path.startsWith("users/")) return path;

    const m = path.match(/(?:^|\/)(users\/.+)$/);
    if (m?.[1]) return m[1];
  } catch {
    return null;
  }
  return null;
}

async function fetchDocumentBuffer(doc: {
  url: string;
  s3Key: string | null;
}): Promise<{ buffer: Buffer | null; reason: "ok" | "too_large" | "unreachable" }> {
  let tooLarge = false;
  for (const headers of FETCH_HEADER_SETS) {
    const fromUrl = await fetchUrlBufferOnce(doc.url, headers);
    if (fromUrl.buffer && fromUrl.buffer.length > 0) {
      return { buffer: fromUrl.buffer, reason: "ok" };
    }
    if (fromUrl.tooLarge) tooLarge = true;
  }

  const maybeKey = doc.s3Key?.startsWith("users/")
    ? doc.s3Key
    : inferS3KeyFromUrl(doc.url);
  if (maybeKey?.startsWith("users/")) {
    const fromS3 = await getObjectBuffer(maybeKey, MAX_SINGLE_ATTACHMENT_BYTES);
    if (fromS3 && fromS3.length > 0) return { buffer: fromS3, reason: "ok" };
  }

  return { buffer: null, reason: tooLarge ? "too_large" : "unreachable" };
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const locked = await requireNonFreeForFeature(session.user.id, "connectors");
  if (locked) return locked;

  const bodyJson = await req.json().catch(() => ({}));
  const parsedBody = sendBodySchema.safeParse(bodyJson);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "Invalid attachment request payload." },
      { status: 400 },
    );
  }

  const attachmentIds = Array.from(
    new Set(parsedBody.data.attachmentDocumentIds ?? []),
  );

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

    const attachments: GmailAttachment[] = [];
    if (attachmentIds.length > 0) {
      const docs = await prisma.document.findMany({
        where: {
          id: { in: attachmentIds },
          userId: session.user.id,
        },
      });

      const docsById = new Map(docs.map((d) => [d.id, d]));
      let totalBytes = 0;

      for (const id of attachmentIds) {
        const doc = docsById.get(id);
        if (!doc) {
          return NextResponse.json(
            { error: "One or more selected attachments were not found." },
            { status: 400 },
          );
        }
        if (!ALLOWED_ATTACHMENT_TYPES.has(doc.type)) {
          return NextResponse.json(
            { error: `Unsupported attachment type for ${doc.name}.` },
            { status: 400 },
          );
        }
        const fetched = await fetchDocumentBuffer(doc);
        const buf = fetched.buffer;
        if (!buf) {
          const reasonText =
            fetched.reason === "too_large"
              ? "The file is larger than the per-attachment limit (10MB)."
              : "The file URL is not reachable from the server.";
          return NextResponse.json(
            {
              error: `Could not download attachment "${doc.name}". ${reasonText} Re-upload the file and try again.`,
            },
            { status: 400 },
          );
        }

        totalBytes += buf.length;
        if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
          return NextResponse.json(
            {
              error:
                "Attachments are too large for a single email. Use fewer or smaller files.",
            },
            { status: 400 },
          );
        }

        attachments.push({
          filename: doc.name,
          contentType: doc.mimeType || "application/octet-stream",
          data: buf,
        });
      }
    }

    const rfc822 = buildRfc822WithAttachments({
      from: externalEmail,
      to,
      subject,
      body,
      attachments,
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
