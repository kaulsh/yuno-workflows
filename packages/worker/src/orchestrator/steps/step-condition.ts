import { evalConditionBranch } from "../eval-condition.js";
import { completeStep } from "./complete-step.js";
import type { ExecuteConditionStepParams } from "./context.js";

export async function executeConditionStep({
  deps,
  run,
  step,
  node,
}: ExecuteConditionStepParams): Promise<Record<string, unknown>> {
  const { prisma } = deps;
  const { id: runId } = run;
  const { id: stepId, stepIndex } = step;

  const predecessorStep = await prisma.workflowStep.findFirst({
    where: { runId, stepIndex: stepIndex - 1 },
    orderBy: { stepIndex: "desc" },
  });
  const predecessorOutput =
    (predecessorStep?.output as Record<string, unknown>) ?? {};

  const branch = evalConditionBranch(node.expression, predecessorOutput);
  const stepOutput = { branch, predecessorOutput };
  await completeStep(prisma, stepId, stepOutput);
  return stepOutput;
}
