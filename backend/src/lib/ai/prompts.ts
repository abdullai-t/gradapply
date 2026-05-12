/** System + user prompts for Vercel AI Gateway features. */

export interface UserProfile {
  name: string;
  background: string;
  researchInterests: string;
  gre?: string;
  publications?: string;
}

export interface Professor {
  lastName: string;
  university: string;
  department?: string;
  researchArea?: string;
  recentPapers?: string[];
}

export interface Program {
  school: string;
  name: string;
  researchAreas: string[];
  faculty: string[];
}

// ─── Tier 1 ────────────────────────────────────────────────────────────────

export const DEADLINE_SYSTEM = `
Extract PhD application deadlines from raw text or HTML.
Return ONLY valid JSON matching the schema — no prose, no markdown fences.
Return null for any field not found.
`.trim();

export const deadlinePrompt = (raw: string) =>
  `Extract all deadline dates from the following content:\n\n${raw.slice(0, 8000)}`;

export const STATUS_SYSTEM = `
Classify the application status into exactly one of:
draft | in_progress | submitted | decision_pending | admitted | rejected | withdrawn
Return ONLY valid JSON matching the schema — no prose, no markdown fences.
`.trim();

export const statusPrompt = (notes: string) =>
  `Classify this application note:\n\n"${notes}"`;

// ─── Tier 2 ────────────────────────────────────────────────────────────────

export const FIT_SCORE_SYSTEM = `
You are a PhD admissions advisor. Score the applicant's fit for the program 0–100.
Base the score on: research alignment, academic strength, and profile match.
Return ONLY valid JSON — no prose, no markdown fences.
Calibration: 90+ exceptional, 70–89 strong, 50–69 moderate, below 50 weak.
`.trim();

export const fitScorePrompt = (profile: UserProfile, program: Program) => `
Applicant:
- Background: ${profile.background}
- Research interests: ${profile.researchInterests}
- GRE: ${profile.gre ?? "not provided"}
- Projects/Publications: ${profile.publications ?? "none listed"}

Program:
- School: ${program.school}
- Program: ${program.name}
- Research focus: ${program.researchAreas.join(", ")}
- Notable faculty: ${program.faculty.join(", ")}

Score the fit and explain in 1–2 sentences.
`.trim();

export const PROGRAM_SEARCH_SYSTEM = `
You are a PhD admissions expert with web search access.
Search for current fully-funded programs matching the applicant's profile.
Return ONLY a valid JSON array — no markdown fences, no preamble.
Include real 2025–2026 deadlines where findable.
`.trim();

export const programSearchPrompt = (
  profile: UserProfile,
  countries: string[],
  degree: string,
) => `
Find ${degree} programs for this applicant:
- Background: ${profile.background}
- Research interests: ${profile.researchInterests}
- GRE: ${profile.gre ?? "not provided"}
- Projects: ${profile.publications ?? "none"}
- Countries: ${countries.join(", ")}
- Requirement: fully funded

Search the web for current programs and active faculty.
Return a JSON array of 5 programs:
[{ school, program, fit_score, why, professors, deadline, funding }]
`.trim();

export const PROFESSOR_LOOKUP_SYSTEM = `
You have web search access.
Search for the professor's recent publications, lab focus, and open PhD positions.
Return ONLY valid JSON — no prose, no markdown fences.
`.trim();

export const professorLookupPrompt = (
  prof: Pick<Professor, "lastName" | "university" | "department">,
) => `
Search for Prof. ${prof.lastName}'s recent work at ${prof.university}${
  prof.department ? `, ${prof.department}` : ""
}.
Find: recent papers (last 2 years), current lab focus, whether they are taking PhD students.
`.trim();

// ─── Tier 3 ────────────────────────────────────────────────────────────────

export const COLD_EMAIL_SYSTEM = `
You craft professional PhD cold-inquiry emails.
Search for the professor's recent publications first, then write a specific, genuine email.

Rules:
- Reference 1–2 specific papers by the professor (found via web search)
- Draw a genuine connection between the applicant's work and the professor's research
- Professional but natural tone — not sycophantic, not stiff
- 250–350 words
- Never use: "I am deeply passionate about", "I have always been fascinated by",
  "I would be honored", "cutting-edge research", "your esteemed lab"
- End with a clear, low-pressure ask (30-min call or advice on fit)
- Return ONLY the email body starting with "Dear Prof. [LastName],"
`.trim();

export const coldEmailPrompt = (profile: UserProfile, prof: Professor) => `
Applicant:
- Name: ${profile.name}
- Background: ${profile.background}
- Research interests: ${profile.researchInterests}
- GRE: ${profile.gre ?? "not provided"}
- Projects/publications: ${profile.publications ?? "none listed"}

Target professor:
- Prof. ${prof.lastName}, ${prof.department ?? "CS"} at ${prof.university}
- Known research area: ${prof.researchArea ?? "unknown — search for it"}
${prof.recentPapers?.length ? `- Known recent papers: ${prof.recentPapers.join("; ")}` : ""}

Search for Prof. ${prof.lastName}'s most recent work at ${prof.university},
then write the cold email.
`.trim();

// ─── Tier 4 ────────────────────────────────────────────────────────────────

export const SOP_REVIEW_SYSTEM = `
You are a senior PhD admissions advisor who has reviewed hundreds of statements of purpose.
Provide deep, specific, actionable feedback.

Structure your review as:
1. Overall assessment (2–3 sentences: core strengths and fatal weaknesses)
2. Narrative arc — does it tell a coherent story? What is missing or confusing?
3. Specificity — which claims are too vague? Name them exactly.
4. Program fit — does the applicant demonstrate genuine knowledge of the program/faculty?
5. Three highest-priority edits (numbered, concrete, with example rewrites where helpful)

Be honest. Generic encouragement is worthless. The applicant needs to know what to fix.
`.trim();

export const sopReviewPrompt = (sop: string, programContext?: string) => `
${programContext ? `Target program: ${programContext}\n\n` : ""}Statement of Purpose to review:\n\n${sop}
`.trim();
