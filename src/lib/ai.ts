import Anthropic from "@anthropic-ai/sdk";
import type { Profile } from "@prisma/client";

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
}: {
  mode: ChatMode;
  message: string;
  history: { role: "user" | "assistant"; content: string }[];
  profile?: Profile | null;
  userId: string;
}): Promise<{ reply: string; routing: AgentRouting }> {
  const routing = routeAssistantAgent(mode, message);

  let knowledge = "";
  try {
    knowledge = (await buildApplicantKnowledgeBlock(userId)).trim();
  } catch {
    knowledge = "";
  }
  const hasKnowledgePack = knowledge.length > 0;

  const system = [
    hasKnowledgePack ? knowledge : null,
    hasKnowledgePack ? assistantContextGroundingRules() : null,
    systemForMode(routing.effectiveMode, profile, {
      embedApplicantSummary: !hasKnowledgePack,
      hasFullApplicantPack: hasKnowledgePack,
    }),
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
      - Never use sycophantic openers like "I am deeply honored", "I came across your
        remarkable work", "I hope this email finds you well", or "Good morning/day."
        Start with a single direct sentence stating who you are and why you are writing.
      - Never exceed 220 words in the body. Count before returning. If over, cut
        Section 2 or Section 3 first — never cut the call to action or funding note.
      - Never use bullet points or lists inside the email body.
      - Never mention GRE scores, CGPA, or years of experience by number in the body.
        These belong in the CV only. Exception: a distinction like "top 5% of class"
        or "summa cum laude" is allowed if stated in one clause, not a full sentence.
      - Never pad with phrases like "directly aligns with", "precisely the foundation",
        "I am passionate about", or "at the intersection of." Be concrete instead.
      - Write in plain, clear academic English — no flowery or promotional language.
      - If the faculty page is missing, very thin, or shows no overlap with the
        applicant's interests, write a sincere general email. Do not fabricate specifics.
      
      EMAIL STRUCTURE (follow this order exactly, no deviations):
      
      1. OPENING (1 sentence only):
         State the degree, program name, and university you are applying to, and that
         you are writing to ask about research opportunities.
         GOOD: "I am applying to the PhD program in Computer Science at [University]
         and am writing to inquire about research opportunities in your lab."
         BAD: "I am Tahiru, a developer with 4 years of experience and a GRE of 338."
         BAD: "Good morning. I am writing to express my deep interest in your work."
      
      2. RESEARCH CONNECTION (3 sentences maximum, ~80–120 words):
         - Sentence 1–2: Name ONE or TWO specific items from the faculty page —
           exact paper titles, project names, grant names, or lab themes as they
           appear on the page. Do not paraphrase titles. Do not name items you
           cannot find on the page.
         - Sentence 3: Pose a concrete research question or state a specific
           technical connection to the applicant's own work. This must be
           substantive — not "this aligns with my interests" but rather what
           specific problem or method you want to explore and why.
         EXAMPLE sentence 3: "I am curious whether the allocator design in DieHarder
         could be adapted for the irregular memory access patterns of large model
         inference, where allocator behavior is a known throughput bottleneck."
      
      3. APPLICANT BACKGROUND (2–3 sentences, ~60–80 words):
         Name the single most relevant project, role, or result from the applicant
         context. Include the project name, the technical method or tool, and one
         concrete outcome or challenge it surfaced. Do not list multiple projects.
         Do not restate research interests already covered in Section 2.
         EXAMPLE: "At MassEnergize I managed AWS infrastructure for a 40-site
         WordPress network and built GhanaCrop AI, a crop disease detector using
         EfficientNet-B3 under edge compute constraints — work that pushed me toward
         systems-level questions about efficient ML inference."
      
      4. FUNDING AND START TERM (1 sentence):
         State that the applicant is seeking full funding and their intended start
         term (e.g. Fall 2026). If unknown, write "I am seeking a fully funded
         position and am flexible on start term."
      
      5. CALL TO ACTION (1 sentence):
         Ask a specific question or request a brief conversation. This must be an
         explicit ask — not a vague closing statement.
         GOOD: "Would you be open to a brief call to discuss whether my background
         fits your current projects?"
         GOOD: "I would welcome the chance to discuss whether there is a fit with
         your lab's current direction."
         BAD: "I have attached my CV for your review." (this is not a call to action)
         BAD: "Thank you for your consideration." (this is a sign-off, not an ask)
      
      6. ATTACHMENTS LINE (1 sentence):
         Mention that CV and research statement are attached.
         EXAMPLE: "I have attached my CV and research statement for your reference."
      
      7. SIGN-OFF:
         "Best regards," on its own line, then applicant full name, then email
         address, then a one-line affiliation (e.g. "KNUST Physics / MassEnergize").
      
      SUBJECT LINE FORMAT:
      "Prospective PhD Applicant – [specific research topic from their page] – [Applicant Last Name]"
      The topic must come from the faculty page, not from the applicant's generic interests.
      BAD:  "Prospective PhD Student – Machine Learning – Abdullai"
      GOOD: "Prospective PhD Applicant – Memory-Safe Runtime Systems – Abdullai"
      
      HARD CONSTRAINTS — VERIFY BEFORE OUTPUTTING:
      □ Body is under 220 words. If not, trim Section 2 or 3.
      □ Opening sentence names degree + program + university. Nothing else.
      □ No GRE scores, no experience years, no CGPA in the body.
      □ Section 2 contains at least one exact item name from the faculty page.
      □ Section 2 ends with a concrete technical question or specific connection.
      □ Section 3 names exactly one project with its method and outcome.
      □ Funding note and start term are present.
      □ There is an explicit ask before the sign-off.
      □ Subject line topic is sourced from the faculty page, not generic.
      
      OUTPUT FORMAT:
      Return ONLY a valid JSON object with exactly two keys:
      - "subject": string
      - "body": string (use actual \n newline characters between paragraphs,
        no HTML, no markdown formatting)
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
