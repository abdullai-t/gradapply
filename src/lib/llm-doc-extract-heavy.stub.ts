/** Cloudflare build stub — heavy PDF/DOCX libs are not bundled on Workers. */

export async function extractDocxWithMammoth(
  _buf: Buffer,
): Promise<string | null> {
  return null;
}

export async function extractPdfWithPdfParse(
  _buf: Buffer,
): Promise<string | null> {
  return null;
}
