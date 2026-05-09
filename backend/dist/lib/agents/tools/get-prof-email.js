// @ts-nocheck
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCached, setCached } from "../cache";
const profEmailInput = z.object({ profEmailId: z.string() });
const profEmailOutput = z.object({
    id: z.string(),
    profName: z.string().nullable(),
    profEmail: z.string().nullable(),
    university: z.string().nullable(),
    profileUrl: z.string().nullable(),
    researchArea: z.string().nullable(),
    emailSubject: z.string().nullable(),
    emailBody: z.string().nullable(),
    status: z.string(),
    lastReplySnippet: z.string().nullable(),
    replyIntent: z.string().nullable(),
    notes: z.string().nullable(),
}).nullable();
export const getProfEmailTool = {
    name: "getProfEmail",
    description: "Loads a professor email record (draft, sent, or replied) by its ID.",
    inputSchema: profEmailInput,
    outputSchema: profEmailOutput,
    cacheable: true,
    estimatedLatencyMs: 40,
    async execute(input, ctx) {
        const cached = getCached(ctx, "getProfEmail", input);
        if (cached !== undefined)
            return cached;
        const record = await prisma.profEmail.findFirst({
            where: { id: input.profEmailId, userId: ctx.userId },
        });
        if (!record) {
            setCached(ctx, "getProfEmail", input, null);
            return null;
        }
        const result = {
            id: record.id,
            profName: record.profName,
            profEmail: record.profEmail,
            university: record.university,
            profileUrl: record.profileUrl,
            researchArea: record.researchArea,
            emailSubject: record.emailSubject,
            emailBody: record.emailBody,
            status: record.status,
            lastReplySnippet: record.lastReplySnippet,
            replyIntent: record.replyIntent,
            notes: record.notes,
        };
        setCached(ctx, "getProfEmail", input, result);
        return result;
    },
};
