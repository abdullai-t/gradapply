# GradApply backend (Node.js + MongoDB)

Express API sharing **`@gradapply/db`** (Mongoose) with the Next.js app. Use it as the **single place for LLM provider secrets** when you proxy `/api/*` from Next (see `BACKEND_PROXY_URL` in `frontend/.env` and `frontend/next.config.mjs`).

## Scripts

```bash
pnpm --filter @gradapply/backend dev    # tsx watch (default port 8080)
pnpm --filter @gradapply/backend build
pnpm --filter @gradapply/backend start  # node dist/index.js
```

## Environment

| Variable | Description |
|----------|-------------|
| `PORT` | Listen port (default **8080** in code; override as needed) |
| `MONGODB_URI` | MongoDB URI (must align with `frontend` when both run) |
| `CORS_ORIGIN` | Allowed browser origins if using **`NEXT_PUBLIC_API_URL`** (comma-separated). Same-origin **`BACKEND_PROXY_URL`** rewrites do not need cross-origin CORS for the UI. |
| `AUTH_SECRET` / `NEXTAUTH_SECRET` | Same value as Next.js so `resolveUserId()` can read JWTs on proxied requests. |

### AI / LLM (configure here, not in `frontend/.env`)

Set **at least one** provider you use:

| Variable | Purpose |
|----------|---------|
| `AI_PROVIDER` | Optional hint: `gemini`, `openrouter`, `anthropic`, `groq`, `openai` |
| `GEMINI_API_KEY` | Google AI Studio / Gemini |
| `OPENAI_API_KEY` | OpenAI |
| `ANTHROPIC_API_KEY` | Anthropic |
| `OPENROUTER_API_KEY` | OpenRouter |
| `GROQ_API_KEY` | Groq |

Optional model overrides: `GEMINI_MODEL`, `OPENAI_MODEL`, `ANTHROPIC_MODEL`, `OPENROUTER_MODEL`, `GROQ_MODEL`, agent-specific `AGENT_*_MODEL` vars (see `src/lib/agents`).

## Frontend integration

1. Run backend: `pnpm --filter @gradapply/backend dev`
2. In **`frontend/.env`**: `BACKEND_PROXY_URL=http://localhost:8080`
3. Restart Next.js — listed `/api/*` routes are rewritten to Express (keys stay on the backend).

## Health

`GET /health` — process up + Mongo connection state.
