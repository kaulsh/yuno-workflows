import type { PrismaClient, WorkflowStep } from "@workspace/db-adapter";
import type {
  WorkflowNode,
  WorkflowEdge,
  TriggerContext,
} from "@workspace/shared";
import { logger } from "@workspace/shared";
import { resolveNextEdges } from "./next-edges.js";
import {
  StepJobPublisher,
  type StepJob,
  type ConfirmChannel,
  type ConsumeContext,
  DiscardException,
  DELAYS_MS,
} from "@workspace/rmq";
import { emitRunEvent } from "../lib/emit-run-event.js";
import { Prisma } from "@workspace/db-adapter";
import { executeEndStep } from "./steps/step-end.js";
import { executeConditionStep } from "./steps/step-condition.js";
import { executeAgentStep } from "./steps/step-agent.js";
import type { OrchestratorDeps } from "./steps/context.js";

export type { StepJob };

/**
 * Processes a single step job from the workflow.steps.q queue.
 *
 * Step lifecycle:
 *  1. Check maxSteps → fail run if exceeded
 *  2. Insert WorkflowStep (status=running) in a transaction
 *  3. Emit step.started
 *  4. Branch on node type (agent | condition | end)
 *  5. Persist output + traces
 *  6. Emit step.completed / step.failed
 *  7. Enqueue next step jobs
 *
 * The caller (executeEventSubscriber consumer) is responsible for acking /
 * letting the retry pipeline handle nacks. This function throws on
 * unrecoverable errors so the subscriber can route to retry or DLX.
 */
export async function processStepJob(
  job: StepJob,
  deps: OrchestratorDeps,
  ctx?: ConsumeContext & { maxRetries?: number },
): Promise<void> {
  const { runId, currentNodeId, inboundMessage, stepIndex } = job;
  const { prisma, publishChannel } = deps;

  const run = await prisma.workflowRun.findUniqueOrThrow({
    where: { id: runId },
    include: { workflow: true },
  });

  if (
    run.status === "failed" ||
    run.status === "completed" ||
    run.status === "cancelled"
  ) {
    throw new DiscardException(
      `run (${runId}) is already terminal, skipping step`,
    );
  }

  const workflow = run.workflow;
  const nodes = workflow.nodes as WorkflowNode[];
  const edges = workflow.edges as WorkflowEdge[];
  const triggerContext = run.triggerContext as TriggerContext;

  const node = nodes.find((n) => n.id === currentNodeId);
  if (!node) {
    await failRun(
      prisma,
      publishChannel,
      run.id,
      `Node "${currentNodeId}" not found in workflow`,
    );
    return;
  }

  const newStepCount = run.stepCount + 1;
  if (newStepCount > workflow.maxSteps) {
    await failRun(prisma, publishChannel, run.id, "max_steps exceeded");
    return;
  }

  const step = await createOrUpdateStep({
    prisma,
    runId: run.id,
    newStepCount,
    stepIndex,
    currentNodeId,
    node,
    inboundMessage,
  });

  await emitRunEvent(prisma, publishChannel, {
    type: "step.started",
    runId: run.id,
    at: new Date().toISOString(),
    stepId: step.id,
    nodeId: currentNodeId,
    agentId: node.type === "agent" ? node.agentId : undefined,
  });

  try {
    if (node.type === "end") {
      await executeEndStep({
        deps,
        run: {
          id: run.id,
          startedAt: run.startedAt,
          totalPromptTokens: run.totalPromptTokens,
          totalCompletionTokens: run.totalCompletionTokens,
          totalCostUsd: run.totalCostUsd,
        },
        step: { id: step.id, nodeId: currentNodeId },
      });
      return;
    }

    const stepContext = {
      id: step.id,
      nodeId: currentNodeId,
      stepIndex,
    };

    const stepOutput =
      node.type === "condition"
        ? await executeConditionStep({
            deps,
            run: { id: run.id },
            step: stepContext,
            node,
          })
        : await executeAgentStep({
            deps,
            run: { id: run.id, triggerContext },
            step: stepContext,
            node,
            input: { inboundMessage },
          });

    try {
      const nextEdges = resolveNextEdges(node, edges, stepOutput);

      for (const { nextNodeId } of nextEdges) {
        const nextNode = nodes.find((n) => n.id === nextNodeId);
        if (!nextNode) {
          await failRun(
            prisma,
            publishChannel,
            run.id,
            `Next node "${nextNodeId}" not found`,
          );
          return;
        }

        await StepJobPublisher(publishChannel).publish(
          {
            runId,
            currentNodeId: nextNodeId,
            inboundMessage: extractMessageForNextStep(stepOutput, node),
            stepIndex: stepIndex + 1,
          },
          ["step"],
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await failRun(prisma, publishChannel, run.id, msg);
    }
  } catch (err) {
    const stepError = err instanceof Error ? err.message : String(err);

    logger.error(
      { stepId: step.id, error: stepError },
      "[orchestrator] step failed",
    );

    await prisma.workflowStep.update({
      where: { id: step.id },
      data: { status: "failed", error: stepError, completedAt: new Date() },
    });

    await emitRunEvent(prisma, publishChannel, {
      type: "step.failed",
      runId,
      at: new Date().toISOString(),
      stepId: step.id,
      nodeId: currentNodeId,
      error: stepError,
    });

    // If this is the final delivery attempt (retry budget exhausted), mark the
    // run as failed so it doesn't stay stuck in "running" indefinitely.
    const maxRetries = ctx?.maxRetries ?? DELAYS_MS.length;
    const retryCount = ctx?.retryCount ?? 0;
    if (retryCount >= maxRetries) {
      await failRun(prisma, publishChannel, run.id, stepError);
    }

    throw err;
  }
}

async function createOrUpdateStep({
  prisma,
  runId,
  newStepCount,
  stepIndex,
  currentNodeId,
  node,
  inboundMessage,
}: {
  prisma: PrismaClient;
  runId: string;
  newStepCount: number;
  stepIndex: number;
  currentNodeId: string;
  node: WorkflowNode;
  inboundMessage: string;
}): Promise<WorkflowStep> {
  try {
    const step = await prisma.$transaction(async (tx) => {
      await tx.workflowRun.update({
        where: { id: runId },
        data: { stepCount: newStepCount, status: "running" },
      });
      return tx.workflowStep.upsert({
        where: {
          runId_stepIndex: {
            runId,
            stepIndex,
          },
        },
        create: {
          stepIndex,
          runId,
          nodeId: currentNodeId,
          nodeType: node.type,
          agentId: node.type === "agent" ? node.agentId : null,
          status: "running",
          inputMessage: inboundMessage,
        },
        update: {
          status: "running",
        },
      });
    });
    return step;
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new DiscardException(
        `duplicate step delivery for run (${runId}), step index (${stepIndex})`,
      );
    }
    throw err;
  }
}

async function failRun(
  prisma: PrismaClient,
  publishChannel: ConfirmChannel,
  runId: string,
  error: string,
): Promise<void> {
  await prisma.workflowRun.update({
    where: { id: runId },
    data: { status: "failed", error, completedAt: new Date() },
  });
  await emitRunEvent(prisma, publishChannel, {
    type: "step.failed",
    runId,
    at: new Date().toISOString(),
    error,
  });
}

function extractMessageForNextStep(
  output: Record<string, unknown>,
  _node: WorkflowNode,
): string {
  if (typeof output.text === "string") return output.text;
  return JSON.stringify(output);
}
