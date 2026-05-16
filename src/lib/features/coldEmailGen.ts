import { orchestrate } from "@/lib/llm/orchestrator";

export async function generateColdEmail({
  userProfile,
  professor,
  program,
  tone = "professional",
  userId,
}: {
  userProfile: {
    name?: string;
    degree?: string;
    field?: string;
    researchInterests?: string[];
    topAchievement?: string;
  };
  professor: {
    name: string;
    department: string;
    university: string;
    researchSummary: string | null;
    publications: string[];
  };
  program: { name: string; degree: string };
  tone?: string;
  userId: string;
}) {
  return orchestrate({
    task: "cold_email_gen",
    staticContext: `
APPLICANT:
Name: ${userProfile.name ?? "Applicant"} | Degree: ${userProfile.degree ?? "n/a"} in ${userProfile.field ?? "n/a"}
Research interests: ${userProfile.researchInterests?.join(", ") ?? "n/a"}
Key achievement: ${userProfile.topAchievement ?? "n/a"}

PROFESSOR:
${professor.name} — ${professor.department}, ${professor.university}
Research focus: ${professor.researchSummary?.slice(0, 400) ?? "n/a"}
Recent publications: ${professor.publications?.slice(0, 3).join("; ") ?? "n/a"}
    `.trim(),
    dynamicContent: `Tone: ${tone}. Program: ${program.name} (${program.degree}). Keep under 250 words. Reference specific research overlap.`,
    userId,
  });
}
