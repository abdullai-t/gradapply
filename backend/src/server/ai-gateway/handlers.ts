import { z } from "zod";

import { aiExtract, aiGenerate, MODELS } from "@/lib/ai/gateway";
import { cacheGet, cacheSet, stableKey } from "@/lib/ai/cache";
import { getAiQueue } from "@/lib/ai/queue";
import {
  COLD_EMAIL_SYSTEM,
  DEADLINE_SYSTEM,
  FIT_SCORE_SYSTEM,
  PROFESSOR_LOOKUP_SYSTEM,
  PROGRAM_SEARCH_SYSTEM,
  STATUS_SYSTEM,
  coldEmailPrompt,
  deadlinePrompt,
  type Program,
  fitScorePrompt,
  professorLookupPrompt,
  programSearchPrompt,
  type UserProfile,
  statusPrompt,
} from "@/lib/ai/prompts";

import { schoolDb } from "@/lib/school-db";

import { withAuth } from "../_with-auth";
import { bad, notFound, ok } from "../_responses";

const ProfileSchema = z.object({
  name: z.string(),
  background: z.string(),
  researchInterests: z.string(),
  gre: z.string().optional(),
  publications: z.string().optional(),
});

const ProgramSchema = z.object({
  school: z.string(),
  name: z.string(),
  researchAreas: z.array(z.string()),
  faculty: z.array(z.string()),
});

const ProfessorSchema = z.object({
  lastName: z.string(),
  university: z.string(),
  department: z.string().optional(),
  researchArea: z.string().optional(),
  recentPapers: z.array(z.string()).optional(),
});

/** Gateway ping — no auth (ops / smoke tests). */
export async function health(): Promise<Response> {
  try {
    const text = await aiGenerate(
      "status_classify",
      "You are a health check. Return only the word: ok",
      "ping",
    );
    return Response.json({
      status: "ok",
      model: MODELS.status_classify,
      response: text.trim(),
    });
  } catch (err) {
    return Response.json(
      { status: "error", message: String(err) },
      { status: 500 },
    );
  }
}

export const deadlineExtract = withAuth(async (req) => {
  try {
    const json = await req.json();
    const rawContent = json?.rawContent;
    if (!rawContent || typeof rawContent !== "string") {
      return bad("rawContent required");
    }
    const result = await aiExtract(
      "deadline_extract",
      DEADLINE_SYSTEM,
      deadlinePrompt(rawContent),
      z.object({
        application_deadline: z.string().nullable(),
        decision_date: z.string().nullable(),
        other_dates: z.array(
          z.object({ label: z.string(), date: z.string() }),
        ),
      }),
    );
    return ok(result);
  } catch {
    return Response.json({ error: "Extraction failed" }, { status: 500 });
  }
});

export const statusClassify = withAuth(async (req) => {
  try {
    const json = await req.json();
    const notes = json?.notes;
    if (!notes || typeof notes !== "string") {
      return bad("notes required");
    }
    const result = await aiExtract(
      "status_classify",
      STATUS_SYSTEM,
      statusPrompt(notes),
      z.object({
        status: z.enum([
          "draft",
          "in_progress",
          "submitted",
          "decision_pending",
          "admitted",
          "rejected",
          "withdrawn",
        ]),
      }),
    );
    return ok(result);
  } catch {
    return Response.json({ error: "Classification failed" }, { status: 500 });
  }
});

export const fitScore = withAuth(async (req) => {
  try {
    const json = await req.json();
    const p = ProfileSchema.parse(json?.profile);
    const prog = ProgramSchema.parse(json?.program);

    const key = stableKey({
      researchInterests: p.researchInterests,
      gre: p.gre,
      school: prog.school,
      name: prog.name,
    });
    const cached = await cacheGet("fit_score", key);
    if (cached) return ok({ result: cached, cached: true });

    const result = await aiExtract(
      "profile_fit",
      FIT_SCORE_SYSTEM,
      fitScorePrompt(p as UserProfile, prog as Program),
      z.object({
        score: z.number().min(0).max(100),
        summary: z.string(),
        strengths: z.array(z.string()),
        gaps: z.array(z.string()),
      }),
    );
    await cacheSet("fit_score", key, result);
    return ok({ result, cached: false });
  } catch {
    return Response.json({ error: "Fit scoring failed" }, { status: 500 });
  }
});

export const programSearch = withAuth(async (req) => {
  try {
    const json = await req.json();
    const p = ProfileSchema.parse(json?.profile);
    const countries = json?.countries ?? ["USA", "Canada", "UK"];
    const degree = json?.degree ?? "PhD";

    const key = stableKey({
      researchInterests: p.researchInterests,
      countries,
      degree,
    });
    const cached = await cacheGet("program", key);
    if (cached) return ok({ programs: cached, cached: true });

    const programs = await aiExtract(
      "program_search",
      PROGRAM_SEARCH_SYSTEM,
      programSearchPrompt(p as UserProfile, countries, degree),
      z.array(
        z.object({
          school: z.string(),
          program: z.string(),
          fit_score: z.number(),
          why: z.string(),
          professors: z.array(z.string()),
          deadline: z.string().nullable(),
          funding: z.string().nullable(),
        }),
      ),
    );
    await cacheSet("program", key, programs);
    return ok({ programs, cached: false });
  } catch {
    return Response.json({ error: "Program search failed" }, { status: 500 });
  }
});

export const professorLookup = withAuth(async (req) => {
  try {
    const json = await req.json();
    const prof = ProfessorSchema.parse(json?.professor);

    const key = stableKey({
      lastName: prof.lastName,
      university: prof.university,
    });
    const cached = await cacheGet("professor", key);
    if (cached) return ok({ profile: cached, cached: true });

    const profile = await aiExtract(
      "professor_lookup",
      PROFESSOR_LOOKUP_SYSTEM,
      professorLookupPrompt({
        lastName: prof.lastName,
        university: prof.university,
        department: prof.department,
      }),
      z.object({
        recentPapers: z.array(
          z.object({
            title: z.string(),
            year: z.number(),
            venue: z.string().optional(),
          }),
        ),
        labFocus: z.string(),
        takingStudents: z.boolean().nullable(),
        labUrl: z.string().optional(),
      }),
    );
    await cacheSet("professor", key, profile);
    return ok({ profile, cached: false });
  } catch {
    return Response.json(
      { error: "Professor lookup failed" },
      { status: 500 },
    );
  }
});

export const postSopReview = withAuth(async (req, { userId }) => {
  try {
    const json = await req.json();
    const schoolId = json?.schoolId ?? json?.applicationId;
    const sop = json?.sop;
    const programContext = json?.programContext;

    if (!schoolId || typeof schoolId !== "string") {
      return bad("schoolId or applicationId required");
    }
    if (!sop || typeof sop !== "string") {
      return bad("sop required");
    }
    if (sop.trim().split(/\s+/).filter(Boolean).length < 200) {
      return bad("SOP must be at least 200 words.");
    }

    const school = await schoolDb.findOne({ _id: schoolId, userId }).lean();
    if (!school) return notFound("School not found");

    const queue = getAiQueue();
    if (!queue) {
      return Response.json(
        {
          error:
            "SOP review queue unavailable (set REDIS_URL for BullMQ worker).",
        },
        { status: 503 },
      );
    }

    await schoolDb.updateOne(
      { _id: schoolId, userId },
      { $set: { "gatewaySopReview.status": "queued" } },
    );

    const job = await queue.add("sop_review", {
      userId,
      schoolId,
      sop,
      programContext,
    });

    return ok({
      jobId: job.id != null ? String(job.id) : undefined,
      status: "queued",
    });
  } catch {
    return Response.json({ error: "Failed to queue SOP review" }, { status: 500 });
  }
});

export const getSopReview = withAuth<{ schoolId: string }>(
  async (req, { userId, params }) => {
    try {
      const schoolId = params.schoolId;
      const school = await schoolDb.findOne({ _id: schoolId, userId })
        .select("gatewaySopReview")
        .lean();
      if (!school) return notFound("School not found");
      const doc = school as { gatewaySopReview?: unknown };
      return ok(doc.gatewaySopReview ?? { status: "not_started" });
    } catch {
      return Response.json(
        { error: "Failed to fetch review status" },
        { status: 500 },
      );
    }
  },
);
