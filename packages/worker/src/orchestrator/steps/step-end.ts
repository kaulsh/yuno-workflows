import { completeStep } from "./complete-step.js";
import { emitRunEvent } from "../../lib/emit-run-event.js";
import type { ExecuteEndStepParams } from "./context.js";

export async function executeEndStep({
  deps,
  run,
  step,
}: ExecuteEndStepParams): Promise<void> {
  const { prisma, publishChannel } = deps;
  const { id: stepId, nodeId } = step;

  const stepOutput = { done: true };
  await completeStep(prisma, stepId, stepOutput);

  const completedAt = new Date();
  await emitRunEvent(prisma, publishChannel, {
    type: "step.completed",
    runId: run.id,
    at: completedAt.toISOString(),
    stepId,
    nodeId,
    output: stepOutput,
    tokens: { promptTokens: 0, completionTokens: 0 },
    costUsd: 0,
  });

  await prisma.workflowRun.update({
    where: { id: run.id },
    data: { status: "completed", completedAt },
  });

  await emitRunEvent(prisma, publishChannel, {
    type: "run.completed",
    runId: run.id,
    at: completedAt.toISOString(),
    totalTokens: run.totalPromptTokens + run.totalCompletionTokens,
    totalCostUsd: Number(run.totalCostUsd),
    durationMs: completedAt.getTime() - new Date(run.startedAt).getTime(),
  });
}
