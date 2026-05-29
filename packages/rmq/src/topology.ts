import type { ChannelModel } from "amqplib";
import { logger } from "@workspace/shared";

export const EX_WORKFLOW_START = "workflow.start";
export const EX_WORKFLOW_STEPS = "workflow.steps";
export const EX_RUN_EVENTS = "run.events";
export const EX_DLX = "workflow.dlx";

export const Q_WORKFLOW_START = "workflow.start.q";
export const Q_WORKFLOW_STEPS = "workflow.steps.q";
export const Q_DLX = "workflow.dlx.q";

/**
 * Asserts all exchanges and queues defined in DESIGN.md §12.
 *
 * Idempotent — safe to call on every worker startup.
 * Uses a short-lived plain channel (not confirm) since we only do assertions.
 */
export async function declareWorkflowTopology(
  connection: ChannelModel,
): Promise<void> {
  const ch = await connection.createChannel();

  // Dead-letter exchange must be declared first (referenced by workflow.steps.q)
  await ch.assertExchange(EX_DLX, "direct", { durable: true });
  await ch.assertQueue(Q_DLX, { durable: true });
  await ch.bindQueue(Q_DLX, EX_DLX, "#");

  // Main exchanges
  await ch.assertExchange(EX_WORKFLOW_START, "direct", { durable: true });
  await ch.assertExchange(EX_WORKFLOW_STEPS, "direct", { durable: true });
  await ch.assertExchange(EX_RUN_EVENTS, "topic", { durable: true });

  // Durable queues for workflow.start and workflow.steps
  await ch.assertQueue(Q_WORKFLOW_START, { durable: true });
  await ch.bindQueue(Q_WORKFLOW_START, EX_WORKFLOW_START, "start");

  // workflow.steps.q has an x-dead-letter-exchange so rejected messages
  // (after retry budget exhausted) land in workflow.dlx.q automatically.
  await ch.assertQueue(Q_WORKFLOW_STEPS, {
    durable: true,
    arguments: { "x-dead-letter-exchange": EX_DLX },
  });
  await ch.bindQueue(Q_WORKFLOW_STEPS, EX_WORKFLOW_STEPS, "step");

  await ch.close();
  logger.info("[rmq] workflow topology declared");
}
