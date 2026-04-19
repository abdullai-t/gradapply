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
  orderedFallbackProviders,
  parseAffordableMaxTokens,
  shouldFallbackToAlternateProvider,
} from "@/lib/llm-credits";
import { executeChatTurnWithCreditFallback } from "@/lib/llm-execute-chat";
import { createDirectOpenAIClient, openAiDefaultModel } from "@/lib/openai-direct";
import {
  assistantContextGroundingRules,
  buildApplicantKnowledgeBlock,
} from "@/lib/llm-user-context";
import { createOpenRouterClient, openRouterModel } from "@/lib/openrouter";

export type { AgentRouting } from "@/lib/assistant-agents";

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
      return `${base}${pack}\nDraft or revise cold outreach emails to professors. Keep them respectful, specific to their research, brief (under ~250 words for the body unless asked otherwise), and appropriate for graduate admissions.\n${p}`;
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
    return typeof content === "string" ? content : "";
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
    return textBlock && textBlock.type === "text" ? textBlock.text : "";
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
  return typeof content === "string" ? content : "";
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
}: {
  system: string;
  user: string;
  maxTokens: number;
  /** When set, prepends full profile + uploaded document text to the system prompt. */
  userId?: string;
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
  let lastErr: unknown;

  for (const provider of chain) {
    let tokens = maxTokens;
    for (let attempt = 0; attempt < 12; attempt++) {
      try {
        return await completeOneShotWithProvider(provider, {
          system: fullSystem,
          user,
          maxTokens: tokens,
        });
      } catch (e) {
        lastErr = e;
        if (!shouldFallbackToAlternateProvider(e)) throw e;
        const affordable = parseAffordableMaxTokens(e);
        if (affordable !== null) {
          tokens = Math.min(tokens, affordable);
          continue;
        }
        if (tokens > 512) {
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

  const userContent = [
    "Compose a cold email asking about graduate research opportunities.",
    "Use the page text above to personalize: reference real research themes, labs, or publications mentioned there. Do not invent facts not supported by the page or applicant context. If the page is thin, stay general but sincere.",
    "Output ONLY valid JSON with keys subject (string) and body (string, plain text paragraphs, no HTML). No markdown fences.",
    "\nApplicant + contact context:\n",
    header,
    pageBlock,
  ].join("");

  const system =
    "You are an expert assistant for graduate applicants. Write a concise cold email from a prospective graduate applicant to a professor. Be humble, professional, and specific where the provided page content allows. Do not claim to have read papers unless the page text clearly supports it. Output ONLY valid JSON with keys subject and body (plain text). No markdown code fences.";

  const raw = await completeOneShotLlm({
    system,
    user: userContent,
    maxTokens: 2048,
    userId,
  });

  try {
    const parsed = JSON.parse(raw) as { subject?: string; body?: string };
    return {
      subject: parsed.subject ?? "Prospective graduate student — quick question",
      body:
        parsed.body ??
        "Hello,\n\nI hope this note finds you well...",
    };
  } catch {
    return {
      subject: "Prospective graduate student — research alignment",
      body: raw,
    };
  }
}
