import type { PrismaClient } from "@workspace/db-adapter";
import { logger } from "@workspace/shared";
import {
  StepJobPublisher,
  type WorkflowStartMessage,
  type ConfirmChannel,
} from "@workspace/rmq";
import type { WorkerDeps } from "./steps/context.js";

export type { WorkflowStartMessage };

/**
 * Handles a workflow.start message:
 *  - Creates a WorkflowRun row (status = pending → running on first step)
 *  - Enqueues the first step job for the entry node
 */
export async function handleWorkflowStart(
  msg: WorkflowStartMessage,
  { prisma }: WorkerDeps,
  publishChannel: ConfirmChannel,
): Promise<void> {
  const { workflowId, runId, initialInput, triggerContext } = msg;

  const workflow = await prisma.workflow.findUniqueOrThrow({
    where: { id: workflowId },
  });

  const run = runId
    ? await prisma.workflowRun.findUniqueOrThrow({ where: { id: runId } })
    : await prisma.workflowRun.create({
        data: {
          workflowId,
          status: "pending",
          triggerContext: triggerContext as object,
          initialInput: initialInput ?? null,
        },
      });

  if (run.workflowId !== workflowId) {
    throw new Error(`run ${run.id} does not belong to workflow ${workflowId}`);
  }
  if (run.status !== "pending") {
    throw new Error(`run ${run.id} is not pending (status=${run.status})`);
  }

  await StepJobPublisher(publishChannel).publish(
    {
      runId: run.id,
      currentNodeId: workflow.entryNodeId,
      inboundMessage: initialInput ?? "",
      stepIndex: 0,
    },
    ["step"],
  );

  logger.info(
    { runId: run.id, workflowName: workflow.name },
    `[orchestrator] run created, first step enqueued`,
  );
}
