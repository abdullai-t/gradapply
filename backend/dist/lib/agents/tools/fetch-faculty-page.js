// @ts-nocheck
import { z } from "zod";
import { fetchProfilePagePlainText, fetchProfilePageForDiscovery, } from "@/lib/profile-page-fetch";
import { getCached, setCached } from "../cache";
// ---------------------------------------------------------------------------
// fetchFacultyPage — fetch + convert HTML to plain text
// ---------------------------------------------------------------------------
const fetchInput = z.object({ url: z.string().url() });
const fetchOutput = z.object({
    url: z.string(),
    text: z.string(),
});
export const fetchFacultyPageTool = {
    name: "fetchFacultyPage",
    description: "Fetches a faculty profile/department page and extracts plain text for analysis.",
    inputSchema: fetchInput,
    outputSchema: fetchOutput,
    cacheable: true,
    estimatedLatencyMs: 5000,
    async execute(input, ctx) {
        const cached = getCached(ctx, "fetchFacultyPage", input);
        if (cached !== undefined)
            return cached;
        const result = await fetchProfilePagePlainText(input.url);
        setCached(ctx, "fetchFacultyPage", input, result);
        return result;
    },
};
// ---------------------------------------------------------------------------
// extractPageLinks — fetch page + extract same-host faculty links
// ---------------------------------------------------------------------------
const linksOutput = z.object({
    url: z.string(),
    text: z.string(),
    links: z.array(z.object({ url: z.string(), label: z.string() })),
});
export const extractPageLinksTool = {
    name: "extractPageLinks",
    description: "Fetches a faculty page and extracts both plain text and same-host hyperlinks for discovery.",
    inputSchema: fetchInput,
    outputSchema: linksOutput,
    cacheable: true,
    estimatedLatencyMs: 5000,
    async execute(input, ctx) {
        const cached = getCached(ctx, "extractPageLinks", input);
        if (cached !== undefined)
            return cached;
        const result = await fetchProfilePageForDiscovery(input.url);
        setCached(ctx, "extractPageLinks", input, result);
        return result;
    },
};
