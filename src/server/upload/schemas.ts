import { z } from "zod";

const ALLOWED_UPLOAD_CONTENT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const presignBodySchema = z.object({
  filename: z.string().min(1),
  contentType: z
    .string()
    .min(1)
    .refine(
      (v) => ALLOWED_UPLOAD_CONTENT_TYPES.has(v.split(";")[0]?.trim().toLowerCase() ?? ""),
      "Unsupported file type for upload.",
    ),
});
