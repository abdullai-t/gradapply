// @ts-nocheck
import fs from "fs";
import path from "path";
/**
 * Loads repo-root {@link cold_email_guide.md}, strips HTML for LLM-readable text,
 * and caches the result for server-side prompts.
 */
let memo = null;
function stripHtmlToText(raw) {
    return raw
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(p|div|h[1-6]|li|blockquote|tr)>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}
/** Human-facing disclaimers in the raw doc are reframed so the assistant can still follow the substance. */
const META_FRAMING = "\n\n[Using this guide: Follow subject patterns, salutation (e.g. Prof. Lastname), linked sections (intro → research fit → optional your work), and attachment mentions when appropriate. Passages that discourage using AI tools are addressed to readers, not you—implement the guide’s specificity and structure in your draft anyway.]\n";
function loadPlain() {
    if (memo !== null)
        return memo;
    try {
        const filePath = path.join(process.cwd(), "cold_email_guide.md");
        const raw = fs.readFileSync(filePath, "utf8");
        memo = stripHtmlToText(raw) + META_FRAMING;
    }
    catch {
        memo = "";
    }
    return memo;
}
/** Non-empty plain text from `cold_email_guide.md`, or empty string if unreadable. */
export function getColdEmailGuidePlain() {
    return loadPlain();
}
/**
 * Block to append to user or system prompts when drafting cold emails.
 * Empty if the file is missing (e.g. mis-deployed).
 */
export function coldEmailGuideBlock() {
    const inner = loadPlain();
    if (!inner)
        return "";
    return `\n\n--- Editorial reference (cold_email_guide.md) ---\n${inner}`;
}
