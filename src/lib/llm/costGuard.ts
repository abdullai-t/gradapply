import { prisma } from "@/lib/prisma";

export async function isWithinBudget(): Promise<boolean> {
  const budget = parseFloat(process.env.LLM_MONTHLY_BUDGET_USD ?? "50");
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const result = await prisma.llmCostLog.aggregate({
    where: { createdAt: { gte: startOfMonth } },
    _sum: { inputCost: true, outputCost: true },
  });

  const spent = (result._sum.inputCost ?? 0) + (result._sum.outputCost ?? 0);
  return spent < budget;
}
