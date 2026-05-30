import { evalConditionBranch } from "../eval-condition.js";
import { emitRunEvent } from "../../lib/emit-run-event.js";
import { completeStep } from "./complete-step.js";
import type { ExecuteConditionStepParams } from "./context.js";

export async function executeConditionStep({
  deps,
  run,
  step,
  node,
}: ExecuteConditionStepParams) {
  const { prisma, publishChannel } = deps;
  const { id: runId } = run;
  const { id: stepId, nodeId, stepIndex } = step;

  const predecessorStep = await prisma.workflowStep.findFirst({
    where: { runId, stepIndex: stepIndex - 1 },
    orderBy: { stepIndex: "desc" },
  });
  const predecessorOutput =
    (predecessorStep?.output as Record<string, unknown>) ?? {};

  const branch = evalConditionBranch(node.expression, predecessorOutput);
  const stepOutput = { branch, predecessorOutput };
  await completeStep(prisma, stepId, stepOutput);

  await emitRunEvent(prisma, publishChannel, {
    type: "step.completed",
    runId,
    at: new Date().toISOString(),
    stepId,
    nodeId,
    output: stepOutput,
    tokens: { promptTokens: 0, completionTokens: 0 },
    costUsd: 0,
  });

  return stepOutput;
}
