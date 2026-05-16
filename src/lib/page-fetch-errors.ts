/** User-facing copy for public page / profile URL fetch failures. */

const HTTP_STATUS_MESSAGES: Record<number, string> = {
  400: "That link appears invalid. Paste a direct faculty or department page URL.",
  401: "That page requires sign-in and can't be read automatically. Use a public profile link instead.",
  403: "That site blocked automated access. Try opening the link in your browser, or use a different public profile URL.",
  404: "We couldn't find that page. The link may be outdated or incorrect — try a different profile URL, or add the professor's name and university so we can look them up.",
  408: "The page took too long to respond. Try again or use a shorter, direct profile URL.",
  410: "That page is no longer available. Try a different profile or department link.",
  429: "That website is rate-limiting requests. Wait a minute and try again.",
};

export function httpStatusUserMessage(status: number): string {
  const known = HTTP_STATUS_MESSAGES[status];
  if (known) return known;
  if (status >= 500) {
    return "That website had a temporary problem. Try again in a few minutes or use a different link.";
  }
  return `We couldn't load that page (the site returned error ${status}). Check that the URL is public and opens in your browser.`;
}

/** Map fetch/URL errors to actionable UI text (never show raw HTTP status lines). */
export function formatPageFetchError(
  error: unknown,
  fallback = "We couldn't load that page. Check the URL and try again.",
): string {
  if (error instanceof Error && error.name === "AbortError") {
    return "The page took too long to load. Check the URL or try again.";
  }

  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  if (!raw.trim()) return fallback;

  const legacyHttp = raw.match(/Page returned HTTP (\d{3})/i);
  if (legacyHttp) return httpStatusUserMessage(Number(legacyHttp[1]));

  const bareHttp = raw.match(/\bHTTP (\d{3})\b/i);
  if (bareHttp && /error|returned|failed/i.test(raw)) {
    return httpStatusUserMessage(Number(bareHttp[1]));
  }

  if (
    /timeout|timed out|ETIMEDOUT|ECONNRESET|ENOTFOUND|ECONNREFUSED|fetch failed|network error|Failed to fetch/i.test(
      raw,
    )
  ) {
    return "We couldn't reach that website. Check your connection and that the URL is correct.";
  }

  if (/Invalid URL/i.test(raw)) {
    return "That doesn't look like a valid web address. Check the link and try again.";
  }

  if (/Only http and https/i.test(raw)) {
    return "Only web links starting with http:// or https:// are supported.";
  }

  if (/host is not allowed|not allowed/i.test(raw) && /host/i.test(raw)) {
    return "That link can't be loaded from here. Use a public university profile page.";
  }

  if (/Invalid redirect/i.test(raw)) {
    return "The link redirected to an invalid address. Try a direct faculty profile URL.";
  }

  if (/must point to an HTML/i.test(raw)) {
    return "That link doesn't point to a web page. Use a faculty profile or department page URL.";
  }

  if (/too large/i.test(raw)) {
    return "That page is too large to process. Try a shorter faculty profile URL.";
  }

  if (/Could not extract enough text/i.test(raw)) {
    return raw;
  }

  if (/No candidate faculty pages/i.test(raw) || /Could not load a readable faculty/i.test(raw)) {
    return raw;
  }

  if (/search HTTP error/i.test(raw)) {
    return "We couldn't look up that professor online right now. Add a direct profile URL and try again.";
  }

  // Already user-facing (no raw status codes or stack traces).
  if (
    raw.length <= 280 &&
    !/\bHTTP \d{3}\b/i.test(raw) &&
    !/ECONN|ETIMED|ENOTFOUND|SyntaxError|TypeError:/i.test(raw)
  ) {
    return raw;
  }

  return fallback;
}
