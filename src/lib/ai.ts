import Anthropic from "@anthropic-ai/sdk";
import type { Profile } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  agentHintLine,
  routeAssistantAgent,
  type AgentRouting,
} from "@/lib/assistant-agents";
import {
  getLlmProvider,
  type LlmProvider,
} from "@/lib/llm-provider";
import {
  classifyLlmErrorClass,
  orderedFallbackProviders,
  parseAffordableMaxTokens,
  shouldFallbackToAlternateProvider,
} from "@/lib/llm-credits";
import { executeChatTurnWithCreditFallback } from "@/lib/llm-execute-chat";
import { createGeminiClient, geminiDefaultModel } from "@/lib/gemini";
import { createGroqClient, groqDefaultModel } from "@/lib/groq";
import {
  acquireProviderLease,
  getProviderRuntimeStatus,
  recordProviderFailure,
  recordProviderSuccess,
  reduceTokensForProviderLoad,
  releaseProviderLease,
} from "@/lib/llm-router";
import { createDirectOpenAIClient, openAiDefaultModel } from "@/lib/openai-direct";
import {
  assistantContextGroundingRules,
  buildApplicantKnowledgeBlock,
} from "@/lib/llm-user-context";
import { createOpenRouterClient, openRouterModel } from "@/lib/openrouter";
import { coldEmailGuideBlock } from "@/lib/cold-email-guide";

export type { AgentRouting } from "@/lib/assistant-agents";

/** Models often wrap JSON in ```json fences despite instructions — strip for parsing. */
function stripLlmMarkdownFence(text: string): string {
  let t = text.trim();
  if (!t.startsWith("```")) return t;
  t = t.replace(/^```(?:json)?\s*\n?/i, "");
  const end = t.lastIndexOf("```");
  if (end !== -1) t = t.slice(0, end);
  return t.trim();
}

/** Best-effort: first top-level `{ ... }` object (email drafts are usually one object). */
function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

type EmailDraftJson = {
  subject?: unknown;
  body?: unknown;
  emailSubject?: unknown;
  emailBody?: unknown;
};

function normalizeProfessorDraftFields(o: EmailDraftJson): {
  subject: string;
  body: string;
} | null {
  const subject =
    (typeof o.subject === "string" && o.subject.trim()) ||
    (typeof o.emailSubject === "string" && o.emailSubject.trim()) ||
    "";
  const bodyRaw =
    (typeof o.body === "string" && o.body) ||
    (typeof o.emailBody === "string" && o.emailBody) ||
    "";
  const body = bodyRaw.trim();
  if (!subject && !body) return null;
  return {
    subject: subject || "Prospective graduate student — quick question",
    body: body || "Hello,\n\nI hope this note finds you well...",
  };
}

function parseProfessorEmailDraft(raw: string): {
  subject: string;
  body: string;
} | null {
  const candidates = [
    raw.trim(),
    stripLlmMarkdownFence(raw),
  ];
  const tried = new Set<string>();
  for (const c of candidates) {
    if (!c || tried.has(c)) continue;
    tried.add(c);
    for (const slice of [c, extractFirstJsonObject(c) ?? ""]) {
      if (!slice.trim()) continue;
      try {
        const o = JSON.parse(slice) as EmailDraftJson;
        const n = normalizeProfessorDraftFields(o);
        if (n) return n;
      } catch {
        /* try next */
      }
    }
  }
  return null;
}

/** Override with e.g. `ANTHROPIC_MODEL=claude-sonnet-4-20250514` */
export function anthropicModel() {
  return (
    process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-20250514"
  );
}

export type ChatMode = "grammar" | "sop" | "email" | "feedback" | "general";

export const systemForMode = (
  mode: ChatMode,
  profile?: Profile | null,
  options?: { embedApplicantSummary?: boolean; hasFullApplicantPack?: boolean },
) => {
  const embedApplicantSummary = options?.embedApplicantSummary !== false;
  const pack =
    options?.hasFullApplicantPack === true
      ? "\nApplicant profile and uploaded document extracts appear earlier in this system message — synthesize from them first; avoid redundant bullet lists asking for items likely already on the CV.\n"
      : "";
  const p =
    embedApplicantSummary && profile
      ? [
          "Applicant context (may be incomplete):",
          profile.targetDegree && `Target degree: ${profile.targetDegree}`,
          profile.focusArea && `Focus: ${profile.focusArea}`,
          profile.researchInterests &&
            `Research interests: ${profile.researchInterests}`,
          profile.undergradSchool && `Undergrad: ${profile.undergradSchool}`,
          profile.bio && `Bio notes: ${profile.bio}`,
        ]
          .filter(Boolean)
          .join("\n")
      : "";

  const base =
    "You are GradApply, an assistant for graduate school applicants. Be concise, actionable, and supportive. Prefer bullet steps when outlining tasks.";

  switch (mode) {
    case "grammar":
      return `${base}${pack}\nFocus on grammar, clarity, and tone improvements. Quote issues briefly and suggest fixes.\n${p}`;
    case "sop":
      return `${base}${pack}\nHelp refine statements of purpose: structure, specificity, alignment with programs, and avoiding clichés.\n${p}`;
    case "email":
      return `${base}${pack}\nDraft or revise cold outreach emails to professors. When the user or context includes faculty page material, surface recent or highlighted work from that material that aligns with the applicant's research interests and reference it concretely; do not invent citations. Keep emails respectful, specific, brief (under ~250 words for the body unless asked otherwise), and appropriate for graduate admissions.${coldEmailGuideBlock()}\n${p}`;
    case "feedback":
      return `${base}${pack}\nGive constructive critique of application materials and strategy.\n${p}`;
    default:
      return `${base}${pack}\n${p}`;
  }
};

async function completeOneShotWithProvider(
  provider: LlmProvider,
  {
    system,
    user,
    maxTokens,
  }: {
    system: string;
    user: string;
    maxTokens: number;
  },
): Promise<string> {
  const lease = await acquireProviderLease(provider);
  const startedAt = Date.now();
  const done = (text: string): string => {
    recordProviderSuccess(provider, Date.now() - startedAt);
    return text;
  };
  try {
    if (provider === "openai") {
      const client = createDirectOpenAIClient();
      const completion = await client.chat.completions.create({
        model: openAiDefaultModel(),
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: maxTokens,
      });
      const content = completion.choices[0]?.message?.content;
      return done(typeof content === "string" ? content : "");
    }

    if (provider === "anthropic") {
      const key = process.env.ANTHROPIC_API_KEY?.trim();
      if (!key) throw new Error("ANTHROPIC_API_KEY is not configured");

      const client = new Anthropic({ apiKey: key });
      const response = await client.messages.create({
        model: anthropicModel(),
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: user }],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      return done(textBlock && textBlock.type === "text" ? textBlock.text : "");
    }

    if (provider === "gemini") {
      const client = createGeminiClient();
      const completion = await client.chat.completions.create({
        model: geminiDefaultModel(),
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: maxTokens,
      });
      const content = completion.choices[0]?.message?.content;
      return done(typeof content === "string" ? content : "");
    }

    if (provider === "groq") {
      const client = createGroqClient();
      const completion = await client.chat.completions.create({
        model: groqDefaultModel(),
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: maxTokens,
      });
      const content = completion.choices[0]?.message?.content;
      return done(typeof content === "string" ? content : "");
    }

    const client = createOpenRouterClient();
    const completion = await client.chat.completions.create({
      model: openRouterModel(),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: maxTokens,
    });

    const content = completion.choices[0]?.message?.content;
    return done(typeof content === "string" ? content : "");
  } catch (error) {
    recordProviderFailure(provider, classifyLlmErrorClass(error));
    throw error;
  } finally {
    releaseProviderLease(lease);
  }
}

/**
 * Single user message + system prompt (JSON-style tasks).
 * Used by school inference and professor extraction flows.
 * Retries with lower max_tokens on 402 / insufficient credits, then other configured providers.
 */
export async function completeOneShotLlm({
  system,
  user,
  maxTokens,
  userId,
  qualityMode = "balanced",
}: {
  system: string;
  user: string;
  maxTokens: number;
  /** When set, prepends full profile + uploaded document text to the system prompt. */
  userId?: string;
  qualityMode?: "balanced" | "high";
}): Promise<string> {
  let fullSystem = system;
  if (userId) {
    try {
      const ctx = await buildApplicantKnowledgeBlock(userId);
      if (ctx.trim()) {
        fullSystem = `${ctx}\n\n${assistantContextGroundingRules()}\n\n--- Task instructions ---\n${system}`;
      }
    } catch {
      /* continue without expanded context */
    }
  }

  const primary = getLlmProvider();
  const chain = orderedFallbackProviders(primary);
  const highQuality = qualityMode === "high";
  let lastErr: unknown;

  for (const provider of chain) {
    let tokens = maxTokens;
    for (let attempt = 0; attempt < 12; attempt++) {
      const status = getProviderRuntimeStatus(provider);
      const shapedTokens = highQuality
        ? tokens
        : reduceTokensForProviderLoad(provider, tokens);
      const startedAt = Date.now();
      try {
        const text = await completeOneShotWithProvider(provider, {
          system: fullSystem,
          user,
          maxTokens: shapedTokens,
        });
        console.info("[llm][oneshot]", {
          provider,
          inFlight: status.inFlight,
          attempt: attempt + 1,
          fallbackUsed: provider !== primary,
          circuitState: status.circuitState,
          latencyMs: Date.now() - startedAt,
          errorClass: null,
          maxTokens: shapedTokens,
        });
        return text;
      } catch (e) {
        lastErr = e;
        const errorClass = classifyLlmErrorClass(e);
        console.warn("[llm][oneshot]", {
          provider,
          inFlight: status.inFlight,
          attempt: attempt + 1,
          fallbackUsed: provider !== primary,
          circuitState: status.circuitState,
          latencyMs: Date.now() - startedAt,
          errorClass,
          maxTokens: shapedTokens,
        });
        if (!shouldFallbackToAlternateProvider(e)) throw e;
        const affordable = parseAffordableMaxTokens(e);
        if (affordable !== null) {
          tokens = Math.min(tokens, affordable);
          continue;
        }
        if (!highQuality && tokens > 512) {
          tokens = Math.floor(tokens / 2);
          continue;
        }
        break;
      }
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error("LLM request failed after credit fallbacks");
}

export async function runAssistantChat({
  mode,
  message,
  history,
  profile,
  userId,
  schoolId,
}: {
  mode: ChatMode;
  message: string;
  history: { role: "user" | "assistant"; content: string }[];
  profile?: Profile | null;
  userId: string;
  /// SOP-studio scope. When set, the agent gets the school + saved variant
  /// + master text loaded into the system prompt so refinement requests
  /// like "tighten the opening" have something concrete to act on.
  schoolId?: string | null;
}): Promise<{ reply: string; routing: AgentRouting }> {
  const routing = routeAssistantAgent(mode, message);

  let knowledge = "";
  try {
    knowledge = (await buildApplicantKnowledgeBlock(userId)).trim();
  } catch {
    knowledge = "";
  }
  const hasKnowledgePack = knowledge.length > 0;

  const sopContextBlock = await loadSopStudioContext({
    userId,
    schoolId: schoolId ?? null,
    effectiveMode: routing.effectiveMode,
  });

  const system = [
    hasKnowledgePack ? knowledge : null,
    hasKnowledgePack ? assistantContextGroundingRules() : null,
    systemForMode(routing.effectiveMode, profile, {
      embedApplicantSummary: !hasKnowledgePack,
      hasFullApplicantPack: hasKnowledgePack,
    }),
    sopContextBlock,
    agentHintLine(routing),
  ]
    .filter((s): s is string => !!s?.trim())
    .join("\n\n");

  const turns = [
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: message },
  ];

  const exec = await executeChatTurnWithCreditFallback({
    preferredProvider: routing.provider,
    preferredModel: routing.model,
    system,
    turns,
    maxTokens:
      routing.effectiveMode === "sop" || routing.effectiveMode === "email"
        ? 8192
        : 4096,
    qualityMode:
      routing.effectiveMode === "sop" ||
      routing.effectiveMode === "email" ||
      routing.effectiveMode === "feedback"
        ? "high"
        : "balanced",
  });

  return {
    reply: exec.text,
    routing: {
      ...routing,
      provider: exec.provider,
      model: exec.model,
      creditFallback: exec.creditFallback,
    },
  };
}

/**
 * Loads the school + saved tailored variant + master SOP text for the SOP
 * studio and renders them as a system-prompt block. Returns empty string
 * when not in SOP mode, no schoolId is provided, or the school can't be
 * found for this user. Truncates long bodies to keep the prompt bounded.
 */
async function loadSopStudioContext({
  userId,
  schoolId,
  effectiveMode,
}: {
  userId: string;
  schoolId: string | null;
  effectiveMode: ChatMode;
}): Promise<string> {
  if (effectiveMode !== "sop" || !schoolId) return "";

  const school = await prisma.school.findFirst({
    where: { id: schoolId, userId },
    include: { sopVariant: true },
  });
  if (!school) return "";

  const variant = school.sopVariant;
  const trim = (s: string | null | undefined, max: number) =>
    !s ? "" : s.length > max ? `${s.slice(0, max)}…` : s;

  const lines = [
    "SOP studio context (the user is tailoring their statement for this school):",
    `- School: ${school.name}`,
    school.program ? `- Program: ${school.program}` : null,
    school.degree ? `- Degree: ${school.degree}` : null,
    school.country ? `- Country: ${school.country}` : null,
    school.deadline
      ? `- Deadline: ${school.deadline.toISOString().slice(0, 10)}`
      : null,
    "",
    variant?.masterText
      ? `Master SOP (the applicant's general-purpose statement, truncated):\n"""\n${trim(variant.masterText, 6000)}\n"""`
      : "Master SOP: not yet provided in this thread.",
    "",
    variant?.body
      ? `Current tailored variant for this school (latest saved body, truncated):\n"""\n${trim(variant.body, 6000)}\n"""`
      : "Current tailored variant: none yet — the next request may ask you to generate one.",
    "",
    "When refining, return only the changed paragraphs unless the user asks for a full rewrite. Verify factual claims about programs, faculty, and labs against the school context above; do not invent specifics.",
  ].filter(Boolean);

  return lines.join("\n");
}

export async function draftProfessorEmail({
  profile,
  profName,
  university,
  researchArea,
  userNotes,
  profilePageUrl,
  profilePageText,
  userId,
}: {
  profile?: Profile | null;
  profName: string;
  university: string;
  researchArea?: string | null;
  userNotes?: string | null;
  /** Original URL (shown to the model for context, not fetched again). */
  profilePageUrl?: string | null;
  /** Plain text extracted from the faculty profile page; primary source for personalization. */
  profilePageText?: string | null;
  /** Loads full profile + documents into the system prompt when set. */
  userId?: string;
}) {
  const header = userId
    ? [
        `Professor (as entered by applicant): ${profName} at ${university}.`,
        researchArea && `Topic / area (applicant notes): ${researchArea}.`,
        userNotes && `Extra notes from applicant: ${userNotes}`,
        profilePageUrl && `Faculty profile URL: ${profilePageUrl}`,
      ]
        .filter(Boolean)
        .join("\n")
    : [
        profile?.targetDegree && `Applicant aims for: ${profile.targetDegree}.`,
        profile?.researchInterests &&
          `Applicant research interests: ${profile.researchInterests}.`,
        profile?.yearsExperience && `Experience: ${profile.yearsExperience}.`,
        `Professor (as entered by applicant): ${profName} at ${university}.`,
        researchArea && `Topic / area (applicant notes): ${researchArea}.`,
        userNotes && `Extra notes from applicant: ${userNotes}`,
        profilePageUrl && `Faculty profile URL: ${profilePageUrl}`,
      ]
        .filter(Boolean)
        .join("\n");

  const pageBlock =
    profilePageText && profilePageText.trim().length > 0
      ? `\n\n--- Faculty / lab page (plain text extracted from the profile URL) ---\n${profilePageText.trim()}\n--- end page ---\n`
      : "";

      const system = `
      You are an expert academic writing coach who helps graduate school applicants
      write cold emails to professors. Your emails are concise, specific, sincere,
      and professional. They never sound generic or AI-generated.
      
      STRICT RULES:
      - Never invent paper titles, results, grants, venues, or collaborators.
      - Never use sycophantic openers like "I am deeply honored" or "I came across your
        remarkable work." Start with a direct, confident sentence.
      - Never exceed 220 words in the body.
      - Never use bullet points or lists inside the email body.
      - Write in plain, clear academic English — no flowery language.
      - If the faculty page is missing or has no overlap with the applicant's interests,
        write a sincere general email without fabricating specifics.
      
      EMAIL STRUCTURE (follow this order exactly):
      1. Opening (1 sentence): Who you are + degree/program you are applying to +
         the specific university. Example: "I am applying to the PhD program in
         Computer Science at [University] and am writing to inquire about research
         opportunities in your lab."
      2. Research connection (2–3 sentences): Reference ONE or TWO specific items
         from the faculty page — paper titles, project names, or lab themes — and
         explain in one concrete sentence why each connects to the applicant's own
         work or interests. Use the exact title or phrasing from the page.
      3. Applicant background (2–3 sentences): Mention the most relevant experience,
         project, or skill from the applicant context. Be specific — name the project,
         tool, or result. Do not list everything; pick what is most relevant to this
         professor's work.
      4. Funding/availability note (1 sentence): State whether the applicant is
         seeking full funding and their intended start term.
      5. Call to action (1 sentence): Ask a specific question or request a brief call.
         Do not say "I would be honored." Say something like "I would welcome the
         chance to discuss whether my background fits your current projects."
      6. Sign-off: "Best regards," then applicant full name, then email, then one-line
         affiliation.
      
      SUBJECT LINE FORMAT:
      "Prospective PhD Student – [One research topic from their page] – [Applicant Last Name]"
      
      OUTPUT FORMAT:
      Return ONLY a valid JSON object with exactly two keys:
      - "subject": string
      - "body": string (use actual newline characters \n between paragraphs, no HTML,
        no markdown)
      No explanation, no markdown fences, nothing outside the JSON object.
      `.trim();

  const userContent = [
    coldEmailGuideBlock(),
    "\n\n--- Applicant and faculty context ---\n",
    header,
    pageBlock,
  ].join("");

  // const system =
  //   "You are an expert assistant for graduate applicants. Write a concise cold email from a prospective graduate applicant to a professor. Follow the in-user editorial reference (cold_email_guide.md) for structure and tone where it does not conflict with the JSON output contract. Ground specificity in the provided page excerpt and applicant context: tie recent or emphasized faculty work to the applicant's interests when the text supports it. Never invent publications or detailed claims. Output ONLY valid JSON with keys subject and body (plain text). No markdown code fences.";

  const raw = await completeOneShotLlm({
    system,
    user: userContent,
    maxTokens: 2048,
    userId,
    qualityMode: "high",
  });

  const parsed = parseProfessorEmailDraft(raw);
  if (parsed) return parsed;

  const stripped = stripLlmMarkdownFence(raw).trim();
  return {
    subject: "Prospective graduate student — research alignment",
    body:
      stripped ||
      "We could not parse the AI draft. Please tap Regenerate or paste your email manually.",
  };
}
