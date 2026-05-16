import { orchestrate } from "@/lib/llm/orchestrator";

export async function scoreFit({
  userProfile,
  program,
  userId,
}: {
  userProfile: {
    gpa?: number;
    gre?: string;
    degree?: string;
    field?: string;
    researchInterests?: string[];
    experience?: string;
    topAchievement?: string;
  };
  program: {
    name: string;
    university: string;
    degree: string;
    funded: boolean;
    deadline: Date | null;
    researchAreas: string[];
    description: string | null;
  };
  userId: string;
}) {
  return orchestrate({
    task: "fit_scoring",
    staticContext: `
USER PROFILE:
GPA: ${userProfile.gpa ?? "n/a"} | GRE: ${userProfile.gre ?? "n/a"} | Degree: ${userProfile.degree ?? "n/a"}
Field: ${userProfile.field ?? "n/a"} | Research interests: ${userProfile.researchInterests?.join(", ") ?? "n/a"}
Experience: ${userProfile.experience ?? "none"} | Key achievement: ${userProfile.topAchievement ?? "n/a"}

TARGET PROGRAM:
${program.name} — ${program.university} (${program.degree})
Funded: ${program.funded ? "yes" : "no"} | Deadline: ${program.deadline?.toISOString() ?? "n/a"}
Research areas: ${program.researchAreas?.join(", ") ?? "n/a"}
Description: ${program.description?.slice(0, 500) ?? "n/a"}
    `.trim(),
    dynamicContent:
      "Score this applicant's fit for the program. Identify research alignment, preparation gaps, and application strategy.",
    userId,
  });
}
