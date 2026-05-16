import { orchestrate } from "@/lib/llm/orchestrator";

/** Heuristic faculty search hints (no live web crawl). */
export async function professorLookupHints({
  topic,
  university,
  departmentHint,
  userId,
}: {
  topic: string;
  university: string;
  departmentHint?: string;
  userId: string;
}) {
  return orchestrate({
    task: "professor_lookup",
    staticContext: `University: ${university}\nDepartment hint: ${departmentHint ?? "n/a"}`.trim(),
    dynamicContent: topic.trim(),
    userId,
  });
}
