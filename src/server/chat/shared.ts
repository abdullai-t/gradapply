import { prisma } from "@/lib/prisma";

let cachedSchoolScopeSupport: boolean | null = null;

export async function chatSupportsSchoolScope(): Promise<boolean> {
  if (cachedSchoolScopeSupport != null) return cachedSchoolScopeSupport;

  try {
    const rows = await prisma.$queryRaw<Array<{ present: number }>>`
      SELECT COUNT(*)::int AS present
      FROM information_schema.columns
      WHERE table_name = 'ChatMessage'
        AND column_name = 'schoolId'
    `;
    const present = rows[0]?.present ?? 0;
    cachedSchoolScopeSupport = present > 0;
    return cachedSchoolScopeSupport;
  } catch {
    cachedSchoolScopeSupport = false;
    return false;
  }
}

export function buildSchoolScopeWhere(
  supportsSchoolScope: boolean,
  schoolId: string | null,
): Record<string, string | null> {
  if (!supportsSchoolScope) return {};
  return schoolId ? { schoolId } : { schoolId: null };
}

export function reverseChronologicalToHistory(
  messages: Array<{ role: string; content: string }>,
): { role: "user" | "assistant"; content: string }[] {
  const history: { role: "user" | "assistant"; content: string }[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    history.push({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    });
  }
  return history;
}
