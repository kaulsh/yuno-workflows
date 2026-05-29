import { publishRunEvent } from "@workspace/rmq";
import { completeStep } from "./complete-step.js";
import type { ExecuteEndStepParams } from "./context.js";

export async function executeEndStep({
  deps,
  run,
  step,
}: ExecuteEndStepParams): Promise<void> {
  const { prisma, publishChannel } = deps;
  const { id: stepId } = step;

  const stepOutput = { done: true };
  await completeStep(prisma, stepId, stepOutput);

  const completedAt = new Date();
  await prisma.workflowRun.update({
    where: { id: run.id },
    data: { status: "completed", completedAt },
  });

  await publishRunEvent(publishChannel, run.id, {
    type: "run.completed",
    runId: run.id,
    at: completedAt.toISOString(),
    totalTokens: run.totalPromptTokens + run.totalCompletionTokens,
    totalCostUsd: Number(run.totalCostUsd),
    durationMs: completedAt.getTime() - new Date(run.startedAt).getTime(),
  });
}
