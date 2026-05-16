import { callOpenRouter } from "./client";
import { MODELS } from "./models";

const GATE_PROMPT = `You are a strict quality judge for a graduate admissions AI tool.
Rate AI output quality from 0.0 to 1.0:
- 0.0–0.4: Off-topic, hallucinated, or missing key content
- 0.5–0.7: Partial — addresses task but lacks depth or specificity
- 0.8–0.9: Good — accurate, relevant, useful
- 1.0: Excellent — specific, structured, actionable

Respond ONLY with valid JSON: { "score": 0.85, "reason": "one sentence" }
No preamble, no markdown fences.`;

export async function scoreOutput(task: string, output: string): Promise<number> {
  try {
    const res = await callOpenRouter({
      model: MODELS.nano.id,
      maxTokens: 80,
      responseFormat: { type: "json_object" },
      messages: [
        { role: "system", content: GATE_PROMPT },
        {
          role: "user",
          content: JSON.stringify({ task, output: output.slice(0, 600) }),
        },
      ],
    });
    const raw = res.choices[0]?.message?.content;
    if (!raw) return 1.0;
    const parsed = JSON.parse(raw) as { score?: unknown };
    const s = typeof parsed.score === "number" ? parsed.score : parseFloat(String(parsed.score));
    return Number.isFinite(s) ? s : 1.0;
  } catch {
    return 1.0;
  }
}
