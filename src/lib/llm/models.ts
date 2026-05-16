export const MODELS = {
  nano: {
    id: "google/gemini-2.0-flash-001",
    label: "Gemini 2.0 Flash",
    inputPer1M: 0.075,
    outputPer1M: 0.3,
    supportsCache: false,
  },
  mid: {
    id: "anthropic/claude-haiku-3-5",
    label: "Claude Haiku 3.5",
    inputPer1M: 0.25,
    outputPer1M: 1.25,
    supportsCache: true,
  },
  power: {
    id: "anthropic/claude-sonnet-4",
    label: "Claude Sonnet 4",
    inputPer1M: 3.0,
    outputPer1M: 15.0,
    supportsCache: true,
  },
  expert: {
    id: "anthropic/claude-opus-4",
    label: "Claude Opus 4",
    inputPer1M: 15.0,
    outputPer1M: 75.0,
    supportsCache: true,
  },
} as const;

export type ModelTier = keyof typeof MODELS;

export const TASK_CONFIG = {
  deadline_extraction: {
    defaultTier: "nano" as ModelTier,
    escalateTo: "mid" as ModelTier,
    qualityThreshold: 0.72,
    maxTokens: 400,
  },
  fit_scoring: {
    defaultTier: "mid" as ModelTier,
    escalateTo: "power" as ModelTier,
    qualityThreshold: 0.8,
    maxTokens: 600,
  },
  program_discovery: {
    defaultTier: "mid" as ModelTier,
    escalateTo: "power" as ModelTier,
    qualityThreshold: 0.78,
    maxTokens: 800,
  },
  professor_lookup: {
    defaultTier: "nano" as ModelTier,
    escalateTo: "mid" as ModelTier,
    qualityThreshold: 0.72,
    maxTokens: 500,
  },
  cold_email_gen: {
    defaultTier: "power" as ModelTier,
    escalateTo: "expert" as ModelTier,
    qualityThreshold: 0.85,
    maxTokens: 900,
  },
  sop_review_relevance: {
    defaultTier: "mid" as ModelTier,
    escalateTo: "power" as ModelTier,
    qualityThreshold: 0.75,
    maxTokens: 500,
  },
  sop_review_tone: {
    defaultTier: "mid" as ModelTier,
    escalateTo: "power" as ModelTier,
    qualityThreshold: 0.75,
    maxTokens: 500,
  },
  sop_review_structure: {
    defaultTier: "mid" as ModelTier,
    escalateTo: "power" as ModelTier,
    qualityThreshold: 0.75,
    maxTokens: 500,
  },
  sop_review_fit: {
    defaultTier: "power" as ModelTier,
    escalateTo: "expert" as ModelTier,
    qualityThreshold: 0.82,
    maxTokens: 700,
  },
} as const;

export type TaskName = keyof typeof TASK_CONFIG;
