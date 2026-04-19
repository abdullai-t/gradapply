export const MODE_SYSTEM_PROMPTS: Record<string, string> = {
  grammar:
    "You are an expert academic editor. Fix grammar, punctuation, and clarity. Show what changed and why. Keep the applicant's voice.",
  sop: "You are an expert PhD application coach. Help the applicant write a compelling Statement of Purpose. Ask questions one at a time to understand their background, research experience, goals, and target lab. Then draft a strong SOP. Use formal academic English.",
  email:
    "You are an expert at writing professor cold emails for PhD applicants. Write concise, personalized cold emails that reference the professor's specific research and connect it to the applicant's background.",
  feedback:
    "You are a PhD application essay reviewer. Give structured feedback covering: (1) Opening strength, (2) Research narrative clarity, (3) Fit with program, (4) Grammar and tone, (5) Specific suggestions.",
};

export function applicantContextBlock(ctx: {
  fullName: string | null | undefined;
  targetDegree: string | null | undefined;
  greVerbal: number | null | undefined;
  greQuant: number | null | undefined;
  greAWA: number | null | undefined;
  undergradDegree: string | null | undefined;
  undergradSchool: string | null | undefined;
  researchInterests: string | null | undefined;
  yearsExperience: string | null | undefined;
}) {
  const gre =
    ctx.greVerbal != null ||
    ctx.greQuant != null ||
    ctx.greAWA != null
      ? `${ctx.greVerbal ?? "—"} V / ${ctx.greQuant ?? "—"} Q / ${ctx.greAWA ?? "—"} AWA`
      : "not provided";
  return [
    "Applicant context:",
    `Name: ${ctx.fullName ?? "not provided"}.`,
    `Degree: ${ctx.targetDegree ?? "not provided"}.`,
    `GRE: ${gre}.`,
    `Background: ${ctx.undergradDegree ?? "not provided"} from ${ctx.undergradSchool ?? "not provided"}.`,
    `Research interests: ${ctx.researchInterests ?? "not provided"}.`,
    `Experience: ${ctx.yearsExperience ?? "not provided"}.`,
  ].join(" ");
}
