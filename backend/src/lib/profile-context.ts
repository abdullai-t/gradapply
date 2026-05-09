// @ts-nocheck
export function formatApplicantContext(
  user: { name?: string | null },
  profile: Record<string, unknown> | null,
): string {
  const name = user.name ?? "";
  const degree = (profile?.targetDegree as string | undefined) ?? "";
  const greScore =
    profile?.greVerbal != null && profile?.greQuant != null
      ? `V:${profile.greVerbal} Q:${profile.greQuant}` +
        (profile?.greAWA != null ? ` AWA:${profile.greAWA}` : "")
      : ((profile?.greScore as string | undefined) ?? "");
  const bgDegree = (profile?.undergradDegree as string | undefined) ?? "";
  const school = (profile?.undergradSchool as string | undefined) ?? "";
  const interests = (profile?.researchInterests as string | undefined) ?? "";
  const exp = (profile?.yearsExperience as string | undefined) ?? "";

  return `Applicant context: Name: ${name}. Degree: ${degree}. GRE: ${greScore}. Background: ${bgDegree} from ${school}. Research interests: ${interests}. Experience: ${exp}.`;
}
