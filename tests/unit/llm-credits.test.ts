import { afterEach, describe, expect, it, vi } from "vitest";

import {
  classifyLlmErrorClass,
  isInsufficientCreditsError,
  isProviderNotConfiguredError,
  orderedFallbackProviders,
  parseAffordableMaxTokens,
  providersWithKeysOrdered,
  shouldFallbackToAlternateProvider,
} from "@/lib/llm-credits";

describe("classifyLlmErrorClass", () => {
  it("classifies circuit open and rate limits", () => {
    expect(classifyLlmErrorClass(new Error("LLM_PROVIDER_CIRCUIT_OPEN"))).toBe(
      "circuit_open",
    );
    expect(classifyLlmErrorClass(new Error("429 Too Many Requests"))).toBe(
      "rate_limited",
    );
    expect(classifyLlmErrorClass(new Error("HTTP 402 payment required"))).toBe(
      "insufficient_credits",
    );
  });

  it("classifies auth and model errors", () => {
    expect(classifyLlmErrorClass(new Error("401 invalid api key"))).toBe(
      "auth_or_config",
    );
    expect(classifyLlmErrorClass(new Error("model not found"))).toBe(
      "model_unavailable",
    );
  });
});

describe("shouldFallbackToAlternateProvider", () => {
  it("falls back on 429 and missing provider config", () => {
    expect(shouldFallbackToAlternateProvider(new Error("429"))).toBe(true);
    expect(
      shouldFallbackToAlternateProvider(new Error("GROQ_API_KEY is not configured")),
    ).toBe(true);
  });

  it("does not fall back on generic 401 without status hint", () => {
    expect(
      shouldFallbackToAlternateProvider(new Error("invalid api key")),
    ).toBe(false);
  });

  it("falls back on explicit 401 status in message", () => {
    expect(shouldFallbackToAlternateProvider(new Error("401 Unauthorized"))).toBe(
      true,
    );
  });
});

describe("parseAffordableMaxTokens", () => {
  it("parses OpenRouter afford hint", () => {
    expect(
      parseAffordableMaxTokens(new Error("can only afford 5000 tokens")),
    ).toBe(Math.floor(5000 * 0.92));
  });

  it("returns null when hint is absent", () => {
    expect(parseAffordableMaxTokens(new Error("other"))).toBeNull();
  });
});

describe("isInsufficientCreditsError", () => {
  it("detects 402 and credit wording", () => {
    expect(isInsufficientCreditsError(new Error("402 requires more credits"))).toBe(
      true,
    );
    expect(isInsufficientCreditsError(new Error("not enough credits"))).toBe(true);
  });
});

describe("isProviderNotConfiguredError", () => {
  it("detects missing env configuration", () => {
    expect(isProviderNotConfiguredError(new Error("OPENROUTER is not set"))).toBe(
      true,
    );
  });
});

describe("providersWithKeysOrdered", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lists configured providers in stable order", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "sk-or-test");
    vi.stubEnv("GROQ_API_KEY", "gsk-test");
    expect(providersWithKeysOrdered()).toEqual(["openrouter", "groq"]);
  });

  it("orderedFallbackProviders rotates primary first", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "sk-or-test");
    vi.stubEnv("GROQ_API_KEY", "gsk-test");
    expect(orderedFallbackProviders("groq")).toEqual(["groq", "openrouter"]);
  });
});
