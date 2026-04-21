import type { LlmProvider } from "@/lib/llm-provider";

type CircuitState = "closed" | "open" | "half-open";

type ProviderState = {
  inFlight: number;
  queued: number;
  waiters: Array<{
    id: number;
    activate: () => void;
    reject: (error: Error) => void;
    timeoutId: ReturnType<typeof setTimeout>;
  }>;
  consecutiveFailures: number;
  circuitOpenedUntilMs: number;
  successes: number;
  failures: number;
  lastLatencyMs: number | null;
  lastErrorClass: string | null;
};

const providerState = new Map<LlmProvider, ProviderState>();
let waiterIdCounter = 0;

function envInt(name: string, fallback: number, min = 0): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.floor(parsed));
}

function maxInflightPerProvider(): number {
  return envInt("LLM_MAX_INFLIGHT_PER_PROVIDER", 6, 1);
}

function queueMax(): number {
  return envInt("LLM_QUEUE_MAX", 0, 0);
}

function queueWaitMs(): number {
  return envInt("LLM_QUEUE_WAIT_MS", 1500, 100);
}

function circuitFailureThreshold(): number {
  return envInt("LLM_CIRCUIT_FAILURE_THRESHOLD", 4, 1);
}

function circuitOpenMs(): number {
  return envInt("LLM_CIRCUIT_OPEN_MS", 45000, 1000);
}

function highLoadReductionPct(): number {
  return envInt("LLM_HIGH_LOAD_TOKEN_REDUCTION_PCT", 25, 0);
}

function stateFor(provider: LlmProvider): ProviderState {
  const existing = providerState.get(provider);
  if (existing) return existing;
  const fresh: ProviderState = {
    inFlight: 0,
    queued: 0,
    waiters: [],
    consecutiveFailures: 0,
    circuitOpenedUntilMs: 0,
    successes: 0,
    failures: 0,
    lastLatencyMs: null,
    lastErrorClass: null,
  };
  providerState.set(provider, fresh);
  return fresh;
}

function getCircuitState(state: ProviderState): CircuitState {
  if (state.circuitOpenedUntilMs <= 0) return "closed";
  if (Date.now() < state.circuitOpenedUntilMs) return "open";
  return "half-open";
}

export class ProviderSaturatedError extends Error {
  code = "LLM_PROVIDER_SATURATED";
  constructor(
    public readonly provider: LlmProvider,
    public readonly inFlight: number,
    public readonly queueDepth: number,
  ) {
    super(`Provider ${provider} is saturated`);
    this.name = "ProviderSaturatedError";
  }
}

export class ProviderCircuitOpenError extends Error {
  code = "LLM_PROVIDER_CIRCUIT_OPEN";
  constructor(
    public readonly provider: LlmProvider,
    public readonly retryAfterMs: number,
  ) {
    super(`Provider ${provider} circuit is open`);
    this.name = "ProviderCircuitOpenError";
  }
}

export type ProviderLease = {
  provider: LlmProvider;
  acquiredAtMs: number;
  released: boolean;
};

export function getProviderRuntimeStatus(provider: LlmProvider): {
  inFlight: number;
  queued: number;
  circuitState: CircuitState;
  retryAfterMs: number;
  consecutiveFailures: number;
} {
  const state = stateFor(provider);
  const circuitState = getCircuitState(state);
  return {
    inFlight: state.inFlight,
    queued: state.queued,
    circuitState,
    retryAfterMs:
      circuitState === "open" ? Math.max(0, state.circuitOpenedUntilMs - Date.now()) : 0,
    consecutiveFailures: state.consecutiveFailures,
  };
}

function maybeRejectForCircuit(provider: LlmProvider, state: ProviderState): void {
  const circuitState = getCircuitState(state);
  if (circuitState !== "open") return;
  throw new ProviderCircuitOpenError(
    provider,
    Math.max(0, state.circuitOpenedUntilMs - Date.now()),
  );
}

export async function acquireProviderLease(provider: LlmProvider): Promise<ProviderLease> {
  const state = stateFor(provider);
  maybeRejectForCircuit(provider, state);
  const maxInflight = maxInflightPerProvider();
  if (state.inFlight < maxInflight) {
    state.inFlight += 1;
    return { provider, acquiredAtMs: Date.now(), released: false };
  }

  const maxQueue = queueMax();
  if (maxQueue <= 0 || state.queued >= maxQueue) {
    throw new ProviderSaturatedError(provider, state.inFlight, state.queued);
  }

  return await new Promise<ProviderLease>((resolve, reject) => {
    state.queued += 1;
    const waiterId = ++waiterIdCounter;
    const timeoutId = setTimeout(() => {
      const idx = state.waiters.findIndex((w) => w.id === waiterId);
      if (idx >= 0) {
        state.waiters.splice(idx, 1);
        state.queued = Math.max(0, state.queued - 1);
      }
      reject(new ProviderSaturatedError(provider, state.inFlight, state.queued));
    }, queueWaitMs());

    const activate = () => {
      clearTimeout(timeoutId);
      state.queued = Math.max(0, state.queued - 1);
      state.inFlight += 1;
      resolve({ provider, acquiredAtMs: Date.now(), released: false });
    };

    state.waiters.push({
      id: waiterId,
      activate,
      reject: (error: Error) => {
        clearTimeout(timeoutId);
        reject(error);
      },
      timeoutId,
    });
  });
}

export function releaseProviderLease(lease: ProviderLease): void {
  if (lease.released) return;
  lease.released = true;
  const state = stateFor(lease.provider);
  state.inFlight = Math.max(0, state.inFlight - 1);
  while (state.waiters.length > 0) {
    const next = state.waiters.shift();
    if (!next) break;
    const circuitState = getCircuitState(state);
    if (circuitState === "open") {
      clearTimeout(next.timeoutId);
      next.reject(
        new ProviderCircuitOpenError(
          lease.provider,
          Math.max(0, state.circuitOpenedUntilMs - Date.now()),
        ),
      );
      state.queued = Math.max(0, state.queued - 1);
      continue;
    }
    next.activate();
    break;
  }
}

export function recordProviderSuccess(provider: LlmProvider, latencyMs: number): void {
  const state = stateFor(provider);
  state.successes += 1;
  state.consecutiveFailures = 0;
  state.circuitOpenedUntilMs = 0;
  state.lastLatencyMs = latencyMs;
}

export function recordProviderFailure(provider: LlmProvider, errorClass: string): void {
  const state = stateFor(provider);
  state.failures += 1;
  state.consecutiveFailures += 1;
  state.lastErrorClass = errorClass;
  const threshold = circuitFailureThreshold();
  if (state.consecutiveFailures >= threshold) {
    state.circuitOpenedUntilMs = Date.now() + circuitOpenMs();
  }
}

export function isProviderUnderHighLoad(provider: LlmProvider): boolean {
  const state = stateFor(provider);
  const maxInflight = maxInflightPerProvider();
  if (maxInflight <= 0) return false;
  const loadRatio = state.inFlight / maxInflight;
  return loadRatio >= 0.7 || state.queued > 0;
}

export function reduceTokensForProviderLoad(
  provider: LlmProvider,
  requestedTokens: number,
  minTokens = 256,
): number {
  if (!isProviderUnderHighLoad(provider)) return requestedTokens;
  const pct = Math.min(90, Math.max(0, highLoadReductionPct()));
  if (pct <= 0) return requestedTokens;
  const reduced = Math.floor(requestedTokens * ((100 - pct) / 100));
  return Math.max(minTokens, Math.min(requestedTokens, reduced));
}
