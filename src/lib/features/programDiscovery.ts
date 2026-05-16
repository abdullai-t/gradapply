import { orchestrate } from "@/lib/llm/orchestrator";

export async function discoverPrograms({
  userProfileSummary,
  preferences,
  userId,
}: {
  userProfileSummary: string;
  preferences: string;
  userId: string;
}) {
  return orchestrate({
    task: "program_discovery",
    staticContext: userProfileSummary.trim(),
    dynamicContent: preferences.trim(),
    userId,
  });
}
