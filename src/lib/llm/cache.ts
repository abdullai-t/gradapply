import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  __gradapplyRedis?: Redis | null;
};

function createRedis(): Redis | null {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;
  try {
    return new Redis(url, { maxRetriesPerRequest: 2, enableReadyCheck: true });
  } catch {
    return null;
  }
}

function getRedis(): Redis | null {
  if (globalForRedis.__gradapplyRedis !== undefined) {
    return globalForRedis.__gradapplyRedis;
  }
  const client = createRedis();
  globalForRedis.__gradapplyRedis = client;
  return client;
}

const SIMILARITY_THRESHOLD = 0.93;
const CACHE_TTL = 60 * 60 * 6;
const MAX_ENTRIES = 150;

async function getEmbedding(text: string): Promise<number[]> {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) throw new Error("OPENROUTER_API_KEY is not set");

  const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/text-embedding-3-small",
      input: text.slice(0, 500),
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenRouter embeddings ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    data?: Array<{ embedding?: number[] }>;
  };
  const emb = data.data?.[0]?.embedding;
  if (!emb?.length) throw new Error("OpenRouter embeddings: empty vector");
  return emb;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    magA += a[i]! ** 2;
    magB += b[i]! ** 2;
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

export async function cacheGet(task: string, promptKey: string): Promise<unknown | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get(`gradapply:llm:${task}`);
    if (!raw) return null;
    const entries = JSON.parse(raw) as Array<{ embedding: number[]; response: unknown }>;
    const queryEmb = await getEmbedding(promptKey);
    for (const entry of entries) {
      if (!entry.embedding?.length) continue;
      if (cosine(queryEmb, entry.embedding) >= SIMILARITY_THRESHOLD) return entry.response;
    }
    return null;
  } catch {
    return null;
  }
}

export async function cacheSet(task: string, promptKey: string, response: unknown) {
  const redis = getRedis();
  if (!redis) return;
  try {
    const key = `gradapply:llm:${task}`;
    const embedding = await getEmbedding(promptKey);
    const raw = await redis.get(key);
    const entries: Array<{ embedding: number[]; response: unknown }> = raw
      ? (JSON.parse(raw) as Array<{ embedding: number[]; response: unknown }>)
      : [];
    entries.push({ embedding, response });
    await redis.set(key, JSON.stringify(entries.slice(-MAX_ENTRIES)), "EX", CACHE_TTL);
  } catch (err) {
    console.warn("[cache set]", err);
  }
}
