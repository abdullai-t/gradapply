import { discoverAndFetchFacultyPage } from "@/lib/faculty-profile-discovery";
import { log } from "@/lib/logger";
import { formatPageFetchError } from "@/lib/page-fetch-errors";
import { fetchProfilePagePlainText } from "@/lib/profile-page-fetch";

export type ResolveFacultyPageInput = {
  profileUrl?: string | null;
  profName?: string | null;
  university?: string | null;
};

export type ResolvedFacultyPage = {
  url: string;
  text: string;
  /** How the page was obtained (for logging / optional UI). */
  source: "profile_url" | "name_lookup";
};

const MISSING_IDENTITY_MSG =
  "Add a professor profile URL, or both professor name and university so we can find a public faculty page.";

const URL_FAILED_NO_IDENTITY_MSG =
  "We couldn't open that profile link. Enter the professor's name and university and try again, or paste a different public profile URL.";

/**
 * Load faculty page text: try profile URL first, then name + university web lookup.
 */
export async function resolveFacultyPage(
  input: ResolveFacultyPageInput,
): Promise<ResolvedFacultyPage> {
  const profileUrl = input.profileUrl?.trim() ?? "";
  const profName = input.profName?.trim() ?? "";
  const university = input.university?.trim() ?? "";

  if (profileUrl) {
    try {
      const page = await fetchProfilePagePlainText(profileUrl);
      return { ...page, source: "profile_url" };
    } catch (e) {
      if (profName && university) {
        log.warn("resolve-faculty-page.url-failed-try-discovery", {
          profileUrl,
          profName,
          university,
          reason: e instanceof Error ? e.message : String(e),
        });
        try {
          const page = await discoverAndFetchFacultyPage(profName, university);
          return { ...page, source: "name_lookup" };
        } catch (discoveryErr) {
          throw new Error(
            formatPageFetchError(
              discoveryErr,
              `We couldn't load the profile link or find a public page for ${profName} at ${university}. Try updating the URL or spelling of the name and school.`,
            ),
          );
        }
      }
      throw new Error(URL_FAILED_NO_IDENTITY_MSG);
    }
  }

  if (profName && university) {
    const page = await discoverAndFetchFacultyPage(profName, university);
    return { ...page, source: "name_lookup" };
  }

  throw new Error(MISSING_IDENTITY_MSG);
}
