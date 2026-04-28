import { prisma } from "@/lib/prisma";

export function chatSupportsSchoolScope(): boolean {
  try {
    const modelFields = (
      prisma as unknown as {
        _runtimeDataModel?: {
          models?: { ChatMessage?: { fields?: Array<{ name?: string }> } };
        };
      }
    )?._runtimeDataModel?.models?.ChatMessage?.fields;
    return Array.isArray(modelFields)
      ? modelFields.some((f: { name?: string }) => f.name === "schoolId")
      : false;
  } catch {
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
