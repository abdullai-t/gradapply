import type { Profile, User } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const MAX_TOTAL_DOC_CHARS = 22_000;
const MAX_PER_DOC_CHARS = 10_000;
const MAX_FETCH_BYTES = 6 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 22_000;

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
): Promise<Buffer | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers,
    });
    if (!res.ok) return null;
    const len = res.headers.get("content-length");
    if (len && Number(len) > MAX_FETCH_BYTES) return null;
    const ab = await res.arrayBuffer();
    if (ab.byteLength > MAX_FETCH_BYTES) return null;
    return Buffer.from(ab);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchDocumentBuffer(url: string): Promise<Buffer | null> {
  for (const h of FETCH_HEADER_SETS) {
    const buf = await fetchDocumentBufferOnce(url, h);
    if (buf && buf.length > 0) return buf;
  }
  return null;
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
        return text.slice(0, MAX_PER_DOC_CHARS);
      } finally {
        await parser.destroy().catch(() => {});
      }
    } catch {
      return null;
    }
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

    const buf = await fetchDocumentBuffer(doc.url);
    if (!buf) {
      stats.fetchFailed += 1;
      parts.push(
        `${meta}\n  _(Server could not download this file from the stored URL — it may be private, expired, or blocked. The applicant can re-upload or paste key facts in chat.)_`,
      );
      continue;
    }

    const text = await bufferToPlainText(buf, doc.mimeType);
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
    "- For essays/SOPs: ground claims in profile + extracts; do not invent GPA, GRE, employers, or rankings.",
    "- Verify school spelling (e.g. Stanford vs “Stamford”) when the user names a university.",
  ].join("\n");
}

/**
 * Rich applicant context: full profile + text extracted from uploaded documents.
 */
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
