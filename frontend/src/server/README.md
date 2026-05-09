# `src/server/` — API handler conventions

This directory holds the **server-side handler logic** for our API routes,
plus the small set of wrappers that absorb the auth / plan-gate / response
boilerplate that used to be duplicated in every `src/app/api/**/route.ts`.

## File layout

```
src/server/
  _responses.ts        # ok() / bad() / unauthorized() / forbidden() / notFound() / created()
  _with-auth.ts        # withAuth(handler)
  _with-plan-gate.ts   # withPlanGate(feature, handler)
  <feature>/
    handlers.ts        # the real GET/POST/PUT/DELETE implementations
    schemas.ts         # zod schemas (re-exported by src/features/<feature>/api.ts)
```

## Where does logic live?

- **`src/app/api/<feature>/route.ts`** — exists only because Next.js requires
  it. Should be a 1–5 line re-export of the handlers in
  `src/server/<feature>/handlers.ts`. **No business logic, no inline auth.**
- **`src/server/<feature>/handlers.ts`** — the real implementation. Each
  exported handler is wrapped with `withAuth` or `withPlanGate` at the point
  of definition.
- **`src/server/<feature>/schemas.ts`** — co-located zod schemas, shared with
  the client via `src/features/<feature>/api.ts`.

## When to use which wrapper

| Wrapper          | Use when…                                                  |
| ---------------- | ---------------------------------------------------------- |
| `withAuth`       | The route only requires a signed-in user.                  |
| `withPlanGate`   | The route is gated to PLUS/PRO for a specific `feature`.   |
| _(none)_         | Public routes (`/api/health`, webhooks, `/api/auth/*`).    |

Both wrappers pass `{ userId, params }` into the inner handler — never call
`auth()` again inside the handler.

## Example: before / after

**Before** — `src/app/api/documents/route.ts` (~115 lines, auth/gate boilerplate
repeated for `GET` and `POST`):

```ts
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const locked = await requireNonFreeForFeature(session.user.id, "documents");
  if (locked) return locked;

  // …actual logic, referencing session.user.id everywhere…
  const documents = await prisma.document.findMany({
    where: { userId: session.user.id /* … */ },
    /* … */
  });
  return NextResponse.json(documents);
}
```

**After** — `src/app/api/documents/route.ts` (5 lines):

```ts
export { GET, POST } from "@/server/documents/handlers";
```

…and the real logic in `src/server/documents/handlers.ts`:

```ts
import { withPlanGate } from "@/server/_with-plan-gate";
import { ok } from "@/server/_responses";
import { prisma } from "@/lib/prisma";

export const GET = withPlanGate("documents", async (_req, { userId }) => {
  const documents = await prisma.document.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return ok(documents);
});
```

The 8-line auth/gate prologue disappears, `userId` is already resolved, and
the response helpers keep the status codes consistent.
