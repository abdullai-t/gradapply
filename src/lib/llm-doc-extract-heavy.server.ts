/**
 * PDF/DOCX extractors that pull in large dependencies (pdf-parse, mammoth).
 * Imported only outside Cloudflare builds — see llm-user-context.ts.
 */

const MAX_PER_DOC_CHARS = 10_000;

export async function extractDocxWithMammoth(
  buf: Buffer,
): Promise<string | null> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer: buf });
  const text = (result.value ?? "").replace(/\s+/g, " ").trim();
  return text.length >= 20 ? text.slice(0, MAX_PER_DOC_CHARS) : null;
}

export async function extractPdfWithPdfParse(
  buf: Buffer,
): Promise<string | null> {
  const { CanvasFactory } = await import("pdf-parse/worker");
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({
    data: new Uint8Array(buf),
    CanvasFactory,
  });
  try {
    const textResult = await parser.getText();
    const text = (textResult.text ?? "").replace(/\s+/g, " ").trim();
    if (text.length >= 20) return text.slice(0, MAX_PER_DOC_CHARS);
  } finally {
    await parser.destroy().catch(() => {});
  }
  return null;
}
