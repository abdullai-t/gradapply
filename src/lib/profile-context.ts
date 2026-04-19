import type { Profile, User } from "@prisma/client";

export function formatApplicantContext(user: User, profile: Profile | null) {
  const name = user.name ?? "";
  const degree = profile?.targetDegree ?? "";
  const greScore =
    profile?.greVerbal != null && profile?.greQuant != null
      ? `V:${profile.greVerbal} Q:${profile.greQuant}` +
        (profile.greAWA != null ? ` AWA:${profile.greAWA}` : "")
      : profile?.greScore ?? "";
  const bgDegree = profile?.undergradDegree ?? "";
  const school = profile?.undergradSchool ?? "";
  const interests = profile?.researchInterests ?? "";
  const exp = profile?.yearsExperience ?? "";

  return `Applicant context: Name: ${name}. Degree: ${degree}. GRE: ${greScore}. Background: ${bgDegree} from ${school}. Research interests: ${interests}. Experience: ${exp}.`;
}
