import type { Profile, User } from "@prisma/client";

/**
 * Maps GradApply `Profile` + `User` into the loose shape used by LLM feature prompts.
 */
export function applicantProfileForLlm(
  user: Pick<User, "name">,
  profile: Profile | null,
): {
  name: string;
  gpa?: number;
  gre?: string;
  degree?: string;
  field?: string;
  researchInterests: string[];
  experience?: string;
  topAchievement?: string;
} {
  const interestsRaw = profile?.researchInterests?.trim();
  const interests =
    interestsRaw?.split(/[,;]/).map((s) => s.trim()).filter(Boolean) ?? [];

  const greParts = [
    profile?.greVerbal != null ? `V ${profile.greVerbal}` : "",
    profile?.greQuant != null ? `Q ${profile.greQuant}` : "",
    profile?.greAWA != null ? `AWA ${profile.greAWA}` : "",
  ].filter(Boolean);
  const greJoined = greParts.length ? greParts.join(", ") : undefined;

  return {
    name: user.name?.trim() || "Applicant",
    gpa: profile?.undergradGPA ?? undefined,
    gre: profile?.greScore?.trim() || greJoined,
    degree: profile?.targetDegree ?? undefined,
    field: profile?.focusArea ?? undefined,
    researchInterests:
      interests.length > 0
        ? interests
        : interestsRaw
          ? [interestsRaw]
          : [],
    experience: profile?.yearsExperience ?? profile?.bio?.slice(0, 400) ?? undefined,
    topAchievement: profile?.bio?.split("\n").find((l) => l.trim().length > 0)?.slice(0, 300),
  };
}
