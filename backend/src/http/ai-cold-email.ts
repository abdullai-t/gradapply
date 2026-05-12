import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { aiStream } from "@/lib/ai/gateway";
import { cacheGet, stableKey } from "@/lib/ai/cache";
import {
  COLD_EMAIL_SYSTEM,
  coldEmailPrompt,
  type Professor,
  type UserProfile,
} from "@/lib/ai/prompts";
import { resolveUserId } from "@/lib/auth-session";
import { isTrustedMutationOrigin } from "@/lib/request-origin";

import { buildWebRequest } from "./web-request";

const ProfileSchema = z.object({
  name: z.string(),
  background: z.string(),
  researchInterests: z.string(),
  gre: z.string().optional(),
  publications: z.string().optional(),
});

const ProfessorSchema = z.object({
  lastName: z.string(),
  university: z.string(),
  department: z.string().optional(),
  researchArea: z.string().optional(),
  recentPapers: z.array(z.string()).optional(),
});

const ColdEmailBodySchema = z.object({
  profile: ProfileSchema,
  professor: ProfessorSchema,
});

/**
 * Streams cold-email body as `text/plain`.
 * Registered as raw Express route because `adapt()` buffers the full `Response`.
 */
export async function coldEmailStreamExpress(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const webReq = buildWebRequest(req);
    const userId = await resolveUserId(webReq);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!isTrustedMutationOrigin(webReq)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    let p: z.infer<typeof ProfileSchema>;
    let prof: z.infer<typeof ProfessorSchema>;

    try {
      const body = ColdEmailBodySchema.parse(req.body);
      p = body.profile;
      prof = body.professor;
    } catch (e) {
      res.status(400).json({
        error: "Invalid body",
        detail: e instanceof z.ZodError ? e.flatten() : String(e),
      });
      return;
    }

    const cacheKey = stableKey({
      lastName: prof.lastName,
      university: prof.university,
    });
    const cachedProf = await cacheGet<{
      recentPapers: Array<{ title: string }>;
    }>("professor", cacheKey);

    const enriched = cachedProf
      ? {
          ...prof,
          recentPapers: cachedProf.recentPapers.map((x) => x.title),
        }
      : prof;

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");

    const stream = aiStream(
      "cold_email",
      COLD_EMAIL_SYSTEM,
      coldEmailPrompt(p as UserProfile, enriched as Professor),
    );
    for await (const chunk of stream.textStream) {
      res.write(chunk);
    }
    res.end();
  } catch (e) {
    if (!res.headersSent) {
      res.status(500).json({ error: "Email generation failed" });
      return;
    }
    next(e);
  }
}
