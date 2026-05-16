import { orchestrate } from "@/lib/llm/orchestrator";

export async function extractDeadline({
  programPageText,
  userId,
}: {
  programPageText: string;
  userId: string;
}) {
  return orchestrate({
    task: "deadline_extraction",
    staticContext: programPageText.slice(0, 8000).trim(),
    dynamicContent:
      "Extract official application deadlines (date + timezone if stated). Return structured JSON only.",
    userId,
  });
}
