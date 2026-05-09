// @ts-nocheck
import { classifyLlmErrorClass, stringifyLlmError } from "@/lib/llm-credits";
/** Reduce accidental disclosure of server filesystem paths in API error JSON. */
function scrubPathsForClient(s) {
    return s
        .replace(/\/(?:Users|home|var)\/[A-Za-z0-9._/-]+/g, "[path]")
        .replace(/[a-z]:\\[^\s]+/gi, "[path]");
}
/**
 * Maps known LLM billing/provider errors into actionable UI text.
 */
export function formatLlmFailureMessage(error) {
    const raw = scrubPathsForClient(stringifyLlmError(error));
    const errorClass = classifyLlmErrorClass(error);
    if (errorClass === "rate_limited") {
        return "Too many AI requests right now. Please wait a moment and try again.";
    }
    if (errorClass === "provider_overloaded") {
        return "The AI service is under heavy load. Please retry in a few moments.";
    }
    if (errorClass === "timeout_or_network") {
        return "The AI request timed out. Please try again in a moment.";
    }
    if (errorClass === "provider_saturated" || errorClass === "circuit_open") {
        return "AI capacity is temporarily constrained. Please retry shortly.";
    }
    if (errorClass === "auth_or_config") {
        return ("AI service is temporarily unavailable due to provider configuration. " +
            "Please contact support if this continues.");
    }
    if (errorClass === "insufficient_credits") {
        return ("The AI provider account is out of quota/credits. " +
            "Please try again later or contact support.");
    }
    if (errorClass === "provider_5xx") {
        return "The AI provider returned a server error. Please retry shortly.";
    }
    if (/credit balance is too low/i.test(raw) ||
        /Plans\s*&\s*Billing/i.test(raw) ||
        /Anthropic API/i.test(raw)) {
        return ("Anthropic refused this request because the API account has no usable credits. " +
            "Add billing at console.anthropic.com, or add OPENAI_API_KEY / OPENROUTER_API_KEY — " +
            "GradApply rotates providers when quota or credits run out.");
    }
    if (/\b402\b/.test(raw) ||
        /requires more credits|can only afford|insufficient.?quota|exceeded your.*quota/i.test(raw)) {
        return ("The LLM provider rejected this request (billing, quota, or token budget). " +
            "Configure more than one of OPENAI_API_KEY, OPENROUTER_API_KEY, and ANTHROPIC_API_KEY — the app switches automatically when possible.");
    }
    if (/\b400\b/.test(raw) ||
        /invalid request|context length|maximum context|max tokens|prompt too long|too many tokens/i.test(raw)) {
        return ("This AI request was too large or invalid for the current model. " +
            "Please shorten your input and try again.");
    }
    return "The AI service could not process this request. Please retry shortly.";
}
