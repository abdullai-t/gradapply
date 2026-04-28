import type { Profile, User } from "@prisma/client";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { getObjectBuffer } from "@/lib/s3";
import { prisma } from "@/lib/prisma";

const MAX_TOTAL_DOC_CHARS = 22_000;
const MAX_PER_DOC_CHARS = 10_000;
const MAX_FETCH_BYTES = 6 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 22_000;

function execFileAsync(
  file: string,
  args: string[],
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      file,
      args,
      { maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr?.trim() || error.message));
          return;
        }
        resolve({ stdout, stderr });
      },
    );
  });
}

async function extractPdfTextViaPdftotext(buf: Buffer): Promise<string | null> {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "gradapply-pdf-"));
  const inPath = path.join(tmpDir, "input.pdf");
  const outPath = path.join(tmpDir, "output.txt");
  try {
    await writeFile(inPath, buf);
    await execFileAsync("/opt/homebrew/bin/pdftotext", [inPath, outPath]);
    const textRaw = await readFile(outPath, "utf8").catch(() => "");
    const text = textRaw.replace(/\s+/g, " ").trim();
    return text.length >= 20 ? text.slice(0, MAX_PER_DOC_CHARS) : null;
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

function decodePdfLiteral(input: string): string {
  let out = "";
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]!;
    if (ch !== "\\") {
      out += ch;
      continue;
    }
    const next = input[i + 1];
    if (!next) break;
    if (/[0-7]/.test(next)) {
      let oct = next;
      if (/[0-7]/.test(input[i + 2] ?? "")) oct += input[i + 2];
      if (/[0-7]/.test(input[i + 3] ?? "")) oct += input[i + 3];
      out += String.fromCharCode(parseInt(oct, 8));
      i += oct.length;
      continue;
    }
    i += 1;
    switch (next) {
      case "n":
        out += "\n";
        break;
      case "r":
        out += "\r";
        break;
      case "t":
        out += "\t";
        break;
      case "b":
        out += "\b";
        break;
      case "f":
        out += "\f";
        break;
      default:
        out += next;
    }
  }
  return out;
}

function extractPdfTextFromRawBytes(buf: Buffer): string {
  const raw = buf.toString("latin1");
  const chunks: string[] = [];

  const singleMatcher = /\((?:\\.|[^\\)])*\)\s*Tj/g;
  let singleMatch: RegExpExecArray | null = singleMatcher.exec(raw);
  while (singleMatch) {
    const token = singleMatch[0];
    if (token) {
      const start = token.indexOf("(");
      const end = token.lastIndexOf(")");
      if (start >= 0 && end > start) {
        chunks.push(decodePdfLiteral(token.slice(start + 1, end)));
      }
    }
    singleMatch = singleMatcher.exec(raw);
  }

  const arrayMatcher = /\[([\s\S]*?)\]\s*TJ/g;
  let arrayMatch: RegExpExecArray | null = arrayMatcher.exec(raw);
  while (arrayMatch) {
    const body = arrayMatch[1];
    if (body) {
      const strings = body.match(/\((?:\\.|[^\\)])*\)/g) ?? [];
      for (const s of strings) {
        chunks.push(decodePdfLiteral(s.slice(1, -1)));
      }
    }
    arrayMatch = arrayMatcher.exec(raw);
  }

  return chunks.join(" ").replace(/\s+/g, " ").trim();
}

const DOC_KIND_LABEL: Record<string, string> = {
  cv: "CV / resume",
  transcript: "Transcript",
  gre: "GRE",
  sop_draft: "Statement of purpose draft",
  other: "Other",
};

function looksLikePdf(buf: Buffer): boolean {
  if (buf.length < 5) return false;
  return buf.subarray(0, 5).toString("ascii") === "%PDF-";
}

const FETCH_HEADER_SETS: Record<string, string>[] = [
  {
    Accept: "*/*",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  },
  {
    Accept: "*/*",
    "User-Agent": "GradApply/1.0 (document fetch; +https://gradapply.local)",
  },
];

async function fetchDocumentBufferOnce(
  url: string,
  headers: Record<string, string>,
): Promise<{ buffer: Buffer | null; reason?: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers,
    });
    if (!res.ok) return { buffer: null, reason: `http_${res.status}` };
    const len = res.headers.get("content-length");
    if (len && Number(len) > MAX_FETCH_BYTES) {
      return { buffer: null, reason: "too_large_content_length" };
    }
    const ab = await res.arrayBuffer();
    if (ab.byteLength > MAX_FETCH_BYTES) {
      return { buffer: null, reason: "too_large_body" };
    }
    return { buffer: Buffer.from(ab) };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return { buffer: null, reason: "timeout" };
    }
    return { buffer: null, reason: "fetch_error" };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchDocumentBuffer(
  url: string,
): Promise<{ buffer: Buffer | null; reason?: string }> {
  let lastReason: string | undefined;
  for (const h of FETCH_HEADER_SETS) {
    const result = await fetchDocumentBufferOnce(url, h);
    if (result.buffer && result.buffer.length > 0) return result;
    lastReason = result.reason ?? lastReason;
  }
  return { buffer: null, reason: lastReason ?? "fetch_failed" };
}

/**
 * Prefer HTTP fetch (works for Cloudinary and public URLs). If that fails but the
 * file lives in our S3 bucket under `users/...`, read it with credentials so private
 * buckets still yield text for the assistant context.
 */
async function fetchDocumentBufferForDoc(doc: {
  id?: string;
  name?: string;
  url: string;
  s3Key: string | null;
}): Promise<{ buffer: Buffer | null; reason?: string }> {
  const fromUrl = await fetchDocumentBuffer(doc.url);
  if (fromUrl.buffer && fromUrl.buffer.length > 0) return fromUrl;
  if (doc.s3Key?.startsWith("users/")) {
    const fromS3 = await getObjectBuffer(doc.s3Key, MAX_FETCH_BYTES);
    if (fromS3 && fromS3.length > 0) return { buffer: fromS3 };
    return {
      buffer: null,
      reason: `s3_fallback_failed:${fromUrl.reason ?? "url_fetch_failed"}`,
    };
  }
  return { buffer: null, reason: fromUrl.reason ?? "url_fetch_failed" };
}

async function bufferToPlainText(buf: Buffer, mime: string | null): Promise<string | null> {
  const m = (mime ?? "").toLowerCase();

  if (m.includes("text/") || m === "application/json") {
    const t = buf.toString("utf8");
    return t.slice(0, MAX_PER_DOC_CHARS);
  }

  if (m.includes("pdf") || looksLikePdf(buf)) {
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(buf) });
      try {
        const textResult = await parser.getText();
        const text = (textResult.text ?? "").replace(/\s+/g, " ").trim();
        if (text.length >= 20) return text.slice(0, MAX_PER_DOC_CHARS);
      } finally {
        await parser.destroy().catch(() => {});
      }
    } catch (e) {
      console.warn("[doc-extraction] pdf-parse primary path failed", {
        reason: e instanceof Error ? e.message : "unknown_error",
      });
    }

    try {
      const mod = await import("pdf-parse");
      const legacy = (
        mod as unknown as {
          default?: (data: Buffer) => Promise<{ text?: string }>;
        }
      ).default;
      if (typeof legacy === "function") {
        const parsed = await legacy(buf);
        const text = (parsed.text ?? "").replace(/\s+/g, " ").trim();
        if (text.length >= 20) return text.slice(0, MAX_PER_DOC_CHARS);
      }
    } catch (e) {
      console.warn("[doc-extraction] pdf-parse fallback path failed", {
        reason: e instanceof Error ? e.message : "unknown_error",
      });
    }

    try {
      const text = extractPdfTextFromRawBytes(buf);
      if (text.length >= 20) return text.slice(0, MAX_PER_DOC_CHARS);
      console.warn("[doc-extraction] raw-pdf fallback yielded too little text", {
        extractedChars: text.length,
      });
    } catch (e) {
      console.warn("[doc-extraction] raw-pdf fallback failed", {
        reason: e instanceof Error ? e.message : "unknown_error",
      });
    }

    try {
      const text = await extractPdfTextViaPdftotext(buf);
      if (text && text.length >= 20) return text;
      console.warn("[doc-extraction] pdftotext fallback yielded too little text");
    } catch (e) {
      console.warn("[doc-extraction] pdftotext fallback failed", {
        reason: e instanceof Error ? e.message : "unknown_error",
      });
    }
    return null;
  }

  return null;
}

export function formatExtendedProfileSection(
  user: Pick<User, "name" | "email">,
  profile: Profile | null,
): string {
  const lines: string[] = ["## Applicant profile"];
  if (user.name?.trim()) lines.push(`- Name: ${user.name.trim()}`);
  if (user.email?.trim()) lines.push(`- Email: ${user.email.trim()}`);

  if (!profile) {
    lines.push("- Structured profile fields are not filled in yet.");
    return lines.join("\n");
  }

  const add = (label: string, v: unknown) => {
    if (v === null || v === undefined || v === "") return;
    lines.push(`- ${label}: ${String(v)}`);
  };

  add("Target degree", profile.targetDegree);
  add("Focus area", profile.focusArea);
  add("GRE (combined / notes)", profile.greScore);
  if (profile.greVerbal != null || profile.greQuant != null) {
    const bits = [
      profile.greVerbal != null ? `V ${profile.greVerbal}` : "",
      profile.greQuant != null ? `Q ${profile.greQuant}` : "",
      profile.greAWA != null ? `AWA ${profile.greAWA}` : "",
    ].filter(Boolean);
    if (bits.length) add("GRE breakdown", bits.join(", "));
  }
  add("Undergrad institution", profile.undergradSchool);
  add("Undergrad degree", profile.undergradDegree);
  add("Undergrad GPA", profile.undergradGPA);
  add("Years experience", profile.yearsExperience);
  add("Research interests", profile.researchInterests);
  if (profile.bio?.trim()) {
    lines.push(`- Bio / narrative:\n${profile.bio.trim()}`);
  }

  return lines.join("\n");
}

type DocLoadStats = {
  listed: number;
  extracted: number;
  fetchFailed: number;
  unsupported: number;
};

async function formatUploadedDocumentsSection(
  userId: string,
): Promise<{ markdown: string; stats: DocLoadStats }> {
  const docs = await prisma.document.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  const stats: DocLoadStats = {
    listed: docs.length,
    extracted: 0,
    fetchFailed: 0,
    unsupported: 0,
  };

  if (docs.length === 0) {
    return {
      markdown:
        "## Uploaded documents\n- No files on record. The applicant can add CV, transcripts, SOP drafts, etc. under Documents.",
      stats,
    };
  }

  const header = "## Uploaded documents (extracted text where possible)";
  const parts: string[] = [header];
  let budget = MAX_TOTAL_DOC_CHARS;

  for (const doc of docs) {
    if (budget < 400) break;

    const label = DOC_KIND_LABEL[doc.type] ?? doc.type;
    const meta = `- **${doc.name}** (${label})`;

    const fetched = await fetchDocumentBufferForDoc(doc);
    if (!fetched.buffer) {
      stats.fetchFailed += 1;
      parts.push(
        `${meta}\n  _(Server could not download this file from the stored URL — it may be private, expired, or blocked. The applicant can re-upload or paste key facts in chat.)_`,
      );
      continue;
    }

    const text = await bufferToPlainText(fetched.buffer, doc.mimeType);
    if (!text || text.length < 20) {
      stats.unsupported += 1;
      parts.push(
        `${meta}\n  _(Format not text-extracted here — e.g. Word .docx or scanned image PDF. Use filename/type as a hint or ask for plain text/PDF with selectable text.)_`,
      );
      continue;
    }

    stats.extracted += 1;
    const slice = text.slice(0, Math.min(MAX_PER_DOC_CHARS, budget));
    budget -= slice.length;
    parts.push(`${meta}\n${slice}`);
  }

  const summary = [
    "",
    "### Document load summary (for the assistant)",
    `- Files listed: ${stats.listed}`,
    `- Files with usable extracted text below: ${stats.extracted}`,
    `- Download failed: ${stats.fetchFailed}`,
    `- Present but not text-extracted (format/scan): ${stats.unsupported}`,
  ].join("\n");

  return { markdown: parts.join("\n\n") + summary, stats };
}

/**
 * Rules placed immediately after the knowledge block so models read them before task text.
 */
export function assistantContextGroundingRules(): string {
  return [
    "### Session rules (mandatory) — read before answering",
    "- The sections **Applicant profile** and **Uploaded documents** above are loaded from GradApply. That is your access to CV, transcript, GRE notes, and other uploads whenever text appears there.",
    "- **Never** say you cannot see uploads if any profile line or document excerpt appears above.",
    "- If the **Document load summary** shows **Files with usable extracted text** ≥ 1, you MUST treat that extracted text as their CV/resume/transcript source: pull employers, roles, dates, projects, skills, and achievements from it.",
    "## Do not ask for what is already above",
    "- Before asking the user to share **companies, roles, years of experience, projects, technologies stack, research, publications, awards, GPA, GRE, or target faculty**, scan **Applicant profile** and **every line of Uploaded documents** above.",
    "- If any of those topics appear in the extracts (even briefly), **use them in your draft or advice** and **do not** ask the user to type them again.",
    "- **Do not** end with a generic checklist (“please share: • companies • projects • publications • faculty”) when the document summary shows usable extracted text or the profile already mentions experience/interests.",
    "- When extracts exist, open with **2–3 concrete facts** you are using (quoted or paraphrased from the text above) so the user sees the materials were read.",
    "- At the end, ask **at most one** narrow follow-up only if something essential is **absent** from both profile and extracts (e.g. one named Stanford faculty member). Never stack four separate requests.",
    "- If summary shows **0** usable extracts but files were listed, say that those files could not be read as text (expired URL, scan-only PDF, or Word doc) and suggest export to **selectable-text PDF** or paste key bullets — do not pretend you read a CV you did not receive as text.",
    "## Profile-first when document text is missing",
    "- If **usable extracted text** is **0** but **Applicant profile** already lists degree, institutions, GRE, experience, research interests, or bio, you **must still deliver** the user’s requested deliverable in full (e.g. a complete Georgia Tech–oriented SOP) using **only** that profile (and any partial doc hints).",
    "- **Do not** refuse, hedge, or **lead** with document URL failures. Write the substantive answer first. At most **one brief closing sentence** may note that attached PDFs were not available as machine-readable text on the server and optional re-upload—never substitute that warning for the draft.",
    "- For essays/SOPs: ground claims in profile + extracts; do not invent GPA, GRE, employers, or rankings.",
    "- Verify school spelling (e.g. Stanford vs “Stamford”) when the user names a university.",
  ].join("\n");
}

/**
 * Rich applicant context: full profile + text extracted from uploaded documents.
 */
/**
 * Extract machine-readable text from a stored document (same pipeline as assistant context).
 */
export async function extractPlainTextFromStoredDocument(doc: {
  id?: string;
  name?: string;
  url: string;
  s3Key: string | null;
  mimeType: string | null;
}): Promise<string | null> {
  const fetched = await fetchDocumentBufferForDoc(doc);
  if (!fetched.buffer) return null;
  const text = await bufferToPlainText(fetched.buffer, doc.mimeType);
  return text && text.length >= 20 ? text : null;
}

export type StoredDocumentExtractionStatus = {
  status: "extracted" | "download_failed" | "unsupported";
  extractedChars: number;
  detail?: string;
};

/**
 * Returns extraction diagnostics for a single stored document.
 * Used by the Documents page to surface user-visible status.
 */
export async function getStoredDocumentExtractionStatus(doc: {
  id?: string;
  name?: string;
  url: string;
  s3Key: string | null;
  mimeType: string | null;
}): Promise<StoredDocumentExtractionStatus> {
  const fetched = await fetchDocumentBufferForDoc(doc);
  if (!fetched.buffer) {
    return {
      status: "download_failed",
      extractedChars: 0,
      detail: fetched.reason ?? "fetch_failed",
    };
  }
  const text = await bufferToPlainText(fetched.buffer, doc.mimeType);
  if (!text || text.length < 20) {
    return {
      status: "unsupported",
      extractedChars: 0,
      detail: `unsupported_mime_or_scan:${doc.mimeType ?? "unknown"}`,
    };
  }
  return {
    status: "extracted",
    extractedChars: text.length,
  };
}

export async function buildApplicantKnowledgeBlock(userId: string): Promise<string> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      return "";
    }

    const profileSection = formatExtendedProfileSection(user, user.profile);
    let docSection: string;
    try {
      const { markdown } = await formatUploadedDocumentsSection(userId);
      docSection = markdown;
    } catch {
      docSection =
        "## Uploaded documents\n- (Could not load document list — continue without file content.)";
    }

    return [
      "The following is authoritative background loaded from this user’s GradApply account (profile + stored file URLs). Use it to personalize every answer.",
      "",
      profileSection,
      "",
      docSection,
    ].join("\n");
  } catch {
    return "";
  }
}
