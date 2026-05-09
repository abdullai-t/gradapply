// @ts-nocheck
import { ConnectorProvider, EmailStatus } from "@/types/enums";

import {
  buildRfc822WithAttachments,
  ensureFreshGmailAccess,
  fetchGmailProfileEmail,
  type GmailAttachment,
  gmailSendRawMessage,
  rfc822ToGmailRaw,
} from "@/lib/gmail-connector";
import { prisma } from "@/lib/prisma";
import { getObjectBuffer } from "@/lib/s3";

import { bad, notFound, ok } from "../_responses";
import { withPlanGate } from "../_with-plan-gate";

import { sendViaGmailBodySchema } from "./schemas";

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
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow", headers });
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

export const sendViaGmail = withPlanGate<{ id: string }>(
  "connectors",
  async (req, { userId, params }) => {
    const bodyJson = await req.json().catch(() => ({}));
    const parsedBody = sendViaGmailBodySchema.safeParse(bodyJson);
    if (!parsedBody.success) return bad("Invalid attachment request payload.");

    const attachmentIds = Array.from(
      new Set(parsedBody.data.attachmentDocumentIds ?? []),
    );

    const row = await prisma.profEmail.findFirst({
      where: { id: params.id, userId },
    });
    if (!row) return notFound();

    const to = row.profEmail?.trim();
    if (!to) return bad("Add a professor email address before sending.");

    const subject = row.emailSubject?.trim();
    const body = row.emailBody?.trim();
    if (!subject || !body) return bad("Subject and body are required.");

    const conn = await prisma.connector.findUnique({
      where: {
        userId_provider: { userId, provider: ConnectorProvider.GMAIL },
      },
    });
    if (!conn) {
      return bad(
        "Gmail is not connected. Open Settings → Connectors and link your mailbox.",
      );
    }

    try {
      const ensured = await ensureFreshGmailAccess(userId);
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
        return bad(
          "Could not determine your Gmail address. Reconnect Gmail in Settings.",
        );
      }

      const attachments: GmailAttachment[] = [];
      if (attachmentIds.length > 0) {
        const docs = await prisma.document.findMany({
          where: { id: { in: attachmentIds }, userId },
        });
        const docsById = new Map(docs.map((d) => [d.id, d]));
        let totalBytes = 0;

        for (const id of attachmentIds) {
          const doc = docsById.get(id);
          if (!doc)
            return bad("One or more selected attachments were not found.");
          if (!ALLOWED_ATTACHMENT_TYPES.has(doc.type))
            return bad(`Unsupported attachment type for ${doc.name}.`);
          const fetched = await fetchDocumentBuffer(doc);
          const buf = fetched.buffer;
          if (!buf) {
            const reasonText =
              fetched.reason === "too_large"
                ? "The file is larger than the per-attachment limit (10MB)."
                : "The file URL is not reachable from the server.";
            return bad(
              `Could not download attachment "${doc.name}". ${reasonText} Re-upload the file and try again.`,
            );
          }
          totalBytes += buf.length;
          if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
            return bad(
              "Attachments are too large for a single email. Use fewer or smaller files.",
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
        data: { status: EmailStatus.SENT, sentAt: new Date() },
      });

      return ok(updated);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to send via Gmail.";
      return bad(msg, 500);
    }
  },
);
