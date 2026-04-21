import pkg from "../../package.json";

export function getAppVersion(): string {
  return pkg.version;
}

function shortSha(sha: string): string {
  const t = sha.trim();
  return t.length >= 7 ? t.slice(0, 7) : t;
}

/**
 * Human-readable build identifier: semver + optional git SHA + deploy context.
 * Uses Vercel env at runtime; local dev shows `dev` when no SHA is present.
 */
export function getBuildLabel(): string {
  const parts: string[] = [`v${getAppVersion()}`];

  const sha =
    process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.trim();
  if (sha) {
    parts.push(shortSha(sha));
  }

  const vercelEnv = process.env.VERCEL_ENV?.trim();
  if (vercelEnv === "preview") {
    parts.push("preview");
  } else if (!sha && process.env.NODE_ENV === "development") {
    parts.push("dev");
  }

  return parts.join(" · ");
}
