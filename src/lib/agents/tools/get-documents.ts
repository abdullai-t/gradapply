import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { extractPlainTextFromStoredDocument } from "@/lib/llm-user-context";

import type { ToolDefinition } from "../types";
import { getCached, setCached } from "../cache";

// ---------------------------------------------------------------------------
// getDocumentText — extract plain text from a stored document
// ---------------------------------------------------------------------------

const docTextInput = z.object({ documentId: z.string() });

const docTextOutput = z.object({
  name: z.string(),
  type: z.string(),
  text: z.string().nullable(),
}).nullable();

type DocTextOutput = z.infer<typeof docTextOutput>;

export const getDocumentTextTool: ToolDefinition<z.infer<typeof docTextInput>, DocTextOutput> = {
  name: "getDocumentText",
  description:
    "Extracts machine-readable plain text from an uploaded document (PDF, text). Returns null if format is unsupported.",
  inputSchema: docTextInput,
  outputSchema: docTextOutput,
  cacheable: true,
  estimatedLatencyMs: 3000,
  async execute(input, ctx): Promise<DocTextOutput> {
    const cached = getCached<DocTextOutput>(ctx, "getDocumentText", input);
    if (cached !== undefined) return cached;

    const doc = await prisma.document.findFirst({
      where: { id: input.documentId, userId: ctx.userId },
    });

    if (!doc) {
      setCached(ctx, "getDocumentText", input, null);
      return null;
    }

    const text = await extractPlainTextFromStoredDocument({
      url: doc.url,
      s3Key: doc.s3Key,
      mimeType: doc.mimeType,
    });

    const result: DocTextOutput = {
      name: doc.name,
      type: doc.type,
      text,
    };

    setCached(ctx, "getDocumentText", input, result);
    return result;
  },
};

// ---------------------------------------------------------------------------
// getDocumentSummary — metadata for all user documents
// ---------------------------------------------------------------------------

const emptyInput = z.object({});

const docSummaryOutput = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    mimeType: z.string().nullable(),
    createdAt: z.string(),
  }),
);

type DocSummaryOutput = z.infer<typeof docSummaryOutput>;

export const getDocumentSummaryTool: ToolDefinition<z.infer<typeof emptyInput>, DocSummaryOutput> = {
  name: "getDocumentSummary",
  description:
    "Lists metadata (id, name, type, mimeType, date) for all user-uploaded documents.",
  inputSchema: emptyInput,
  outputSchema: docSummaryOutput,
  cacheable: true,
  estimatedLatencyMs: 40,
  async execute(_input, ctx): Promise<DocSummaryOutput> {
    const cached = getCached<DocSummaryOutput>(ctx, "getDocumentSummary", {});
    if (cached !== undefined) return cached;

    const docs = await prisma.document.findMany({
      where: { userId: ctx.userId },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: { id: true, name: true, type: true, mimeType: true, createdAt: true },
    });

    const result: DocSummaryOutput = docs.map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      mimeType: d.mimeType,
      createdAt: d.createdAt.toISOString(),
    }));

    setCached(ctx, "getDocumentSummary", {}, result);
    return result;
  },
};
