function envModel(envKey: string, fallback: string): string {
  const v = process.env[envKey]?.trim();
  return v || fallback;
}

/**
 * Model slugs for `aiGenerate` / `cachedAiGenerate`: `groq/<id>` or OpenRouter catalog ids
 * (`anthropic/...`, `openai/...`, `google/...`) routed via OpenRouter.
 * Override any via `AI_MODEL_*` env vars.
 */
export const MODELS = {
  router: envModel("AI_MODEL_ROUTER", "groq/llama-3.1-8b-instant"),
  grammar: envModel("AI_MODEL_GRAMMAR", "groq/llama-3.3-70b-versatile"),
  navigator: envModel("AI_MODEL_NAVIGATOR", "groq/llama-3.3-70b-versatile"),
  school_intel: envModel("AI_MODEL_SCHOOL_INTEL", "google/gemini-2.0-flash-001"),
  sop_writer: envModel("AI_MODEL_SOP_WRITER", "anthropic/claude-sonnet-4"),
  sop_scorer: envModel("AI_MODEL_SOP_SCORER", "anthropic/claude-sonnet-4"),
  email_drafter: envModel("AI_MODEL_EMAIL_DRAFTER", "anthropic/claude-sonnet-4"),
  prof_audit: envModel("AI_MODEL_PROF_AUDIT", "google/gemini-2.0-flash-001"),
  faculty_discovery: envModel(
    "AI_MODEL_FACULTY_DISCOVERY",
    "groq/llama-3.3-70b-versatile",
  ),
  reply_analyzer: envModel("AI_MODEL_REPLY_ANALYZER", "groq/llama-3.3-70b-versatile"),
  cold_email: envModel("AI_MODEL_COLD_EMAIL", "anthropic/claude-sonnet-4"),
  sop_review: envModel("AI_MODEL_SOP_REVIEW", "openai/gpt-4o-mini"),
  deadline_extract: envModel("AI_MODEL_DEADLINE_EXTRACT", "groq/llama-3.1-8b-instant"),
  status_classify: envModel("AI_MODEL_STATUS_CLASSIFY", "groq/llama-3.1-8b-instant"),
  profile_fit: envModel("AI_MODEL_PROFILE_FIT", "anthropic/claude-sonnet-4"),
  program_search: envModel("AI_MODEL_PROGRAM_SEARCH", "groq/llama-3.3-70b-versatile"),
  professor_lookup: envModel("AI_MODEL_PROFESSOR_LOOKUP", "groq/llama-3.3-70b-versatile"),
} as const;

export type FeatureKey = keyof typeof MODELS;

/** Map GradApply agent ids to feature model keys. */
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
