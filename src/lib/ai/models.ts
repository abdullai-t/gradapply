function envModel(envKey: string, fallback: string): string {
  const v = process.env[envKey]?.trim();
  return v || fallback;
}

/**
 * Cloudflare AI Gateway unified model ids (`{provider}/{model}`).
 * Override any via `AI_MODEL_*` env vars.
 *
 * @see https://developers.cloudflare.com/ai-gateway/usage/chat-completion/
 */
export const MODELS = {
  router: envModel("AI_MODEL_ROUTER", "google-ai-studio/gemini-2.5-flash-lite"),
  grammar: envModel("AI_MODEL_GRAMMAR", "groq/llama-3.3-70b-versatile"),
  navigator: envModel("AI_MODEL_NAVIGATOR", "google-ai-studio/gemini-2.5-flash"),
  school_intel: envModel(
    "AI_MODEL_SCHOOL_INTEL",
    "google-ai-studio/gemini-2.5-flash",
  ),
  sop_writer: envModel("AI_MODEL_SOP_WRITER", "openai/gpt-4o"),
  sop_scorer: envModel("AI_MODEL_SOP_SCORER", "anthropic/claude-sonnet-4"),
  email_drafter: envModel("AI_MODEL_EMAIL_DRAFTER", "anthropic/claude-sonnet-4"),
  prof_audit: envModel("AI_MODEL_PROF_AUDIT", "google-ai-studio/gemini-2.5-flash"),
  faculty_discovery: envModel(
    "AI_MODEL_FACULTY_DISCOVERY",
    "google-ai-studio/gemini-2.5-flash",
  ),
  reply_analyzer: envModel(
    "AI_MODEL_REPLY_ANALYZER",
    "google-ai-studio/gemini-2.5-flash",
  ),
  cold_email: envModel("AI_MODEL_COLD_EMAIL", "anthropic/claude-sonnet-4"),
  sop_review: envModel("AI_MODEL_SOP_REVIEW", "openai/gpt-4o"),
  deadline_extract: envModel(
    "AI_MODEL_DEADLINE_EXTRACT",
    "google-ai-studio/gemini-2.5-flash-lite",
  ),
  status_classify: envModel(
    "AI_MODEL_STATUS_CLASSIFY",
    "google-ai-studio/gemini-2.5-flash-lite",
  ),
  profile_fit: envModel("AI_MODEL_PROFILE_FIT", "anthropic/claude-sonnet-4"),
  program_search: envModel(
    "AI_MODEL_PROGRAM_SEARCH",
    "google-ai-studio/gemini-2.5-flash",
  ),
  professor_lookup: envModel(
    "AI_MODEL_PROFESSOR_LOOKUP",
    "google-ai-studio/gemini-2.5-flash",
  ),
} as const;

export type FeatureKey = keyof typeof MODELS;

/** Map GradApply agent ids to gateway feature model keys. */
export const AGENT_MODEL_FEATURE: Partial<Record<string, FeatureKey>> = {
  orchestrator: "router",
  grammar: "grammar",
  navigator: "navigator",
  "school-intel": "school_intel",
  "sop-writer": "sop_writer",
  "sop-scorer": "sop_scorer",
  "email-drafter": "email_drafter",
  "professor-audit": "prof_audit",
  "faculty-discovery": "faculty_discovery",
  "reply-analyzer": "reply_analyzer",
};
