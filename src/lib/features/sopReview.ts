import { orchestrate } from "@/lib/llm/orchestrator";

function dimensionScore(obj: unknown): number {
  if (obj && typeof obj === "object" && "score" in obj) {
    const s = (obj as { score: unknown }).score;
    const n = typeof s === "number" ? s : parseFloat(String(s));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export async function reviewSOP({
  sopText,
  userProfile,
  program,
  userId,
}: {
  sopText: string;
  userProfile: { name?: string; degree?: string; field?: string };
  program: { name: string; university: string; degree: string };
  userId: string;
}) {
  const staticContext = `
STATEMENT OF PURPOSE:
${sopText.slice(0, 3000)}

APPLICANT: ${userProfile.name ?? "Applicant"} | ${userProfile.degree ?? "n/a"} in ${userProfile.field ?? "n/a"}
TARGET PROGRAM: ${program.name} — ${program.university} (${program.degree})
  `.trim();

  const [relevance, tone, structure, fit] = await Promise.all([
    orchestrate({
      task: "sop_review_relevance",
      staticContext,
      dynamicContent:
        "Evaluate how well this SOP addresses the program's research focus. Score 0–100, list gaps.",
      userId,
    }),
    orchestrate({
      task: "sop_review_tone",
      staticContext,
      dynamicContent: "Evaluate academic tone and voice. Score 0–100 with quoted examples.",
      userId,
    }),
    orchestrate({
      task: "sop_review_structure",
      staticContext,
      dynamicContent:
        "Evaluate narrative structure: hook → background → research → goals → fit. Score 0–100.",
      userId,
    }),
    orchestrate({
      task: "sop_review_fit",
      staticContext,
      dynamicContent:
        "Evaluate research overlap, faculty alignment, and preparation signals. Score 0–100.",
      userId,
      forceTier: "power",
    }),
  ]);

  const overallScore = Math.round(
    [relevance, tone, structure, fit]
      .map((r) => dimensionScore(r.result))
      .reduce((a, b) => a + b, 0) / 4,
  );

  return {
    overallScore,
    dimensions: {
      relevance: relevance.result,
      tone: tone.result,
      structure: structure.result,
      fit: fit.result,
    },
  };
}
