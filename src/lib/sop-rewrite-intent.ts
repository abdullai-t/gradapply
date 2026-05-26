/** User wants the entire SOP draft rewritten (not a chat-only reply). */
export function isWholeDocumentRewriteRequest(message: string): boolean {
  const t = message.trim().toLowerCase();
  if (t.length < 8) return false;

  if (
    /\b(rewrite|redraft|revise|rework)\b[\s\S]{0,40}\b(whole|entire|full|complete|everything|all of it)\b/.test(
      t,
    )
  ) {
    return true;
  }
  if (
    /\b(whole|entire|full|complete)\b[\s\S]{0,40}\b(draft|sop|statement|essay|document)\b/.test(
      t,
    )
  ) {
    return true;
  }
  if (/\brewrite the (whole |entire |full )?(draft|sop|statement|essay)\b/.test(t)) {
    return true;
  }
  if (/\b(cut|shorten|trim)\b[\s\S]{0,30}\b(draft|sop|essay|to \d+ words)\b/.test(t)) {
    return true;
  }
  if (/\bmake\b[\s\S]{0,25}\b(less|more) (academic|formal|concise)\b/.test(t)) {
    return true;
  }
  return false;
}
