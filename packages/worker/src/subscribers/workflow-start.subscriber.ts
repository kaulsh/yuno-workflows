import type { PrismaClient } from "@workspace/db-adapter";
import type { EventSubscriberDef } from "@workspace/rmq";
import { WorkflowStartDefinition } from "@workspace/rmq";
import { Q_WORKFLOW_START } from "@workspace/rmq";
import type { WorkflowStartMessage } from "@workspace/rmq";
import type { ConfirmChannel } from "amqplib";
import { handleWorkflowStart } from "../orchestrator/start-run.js";
import type { WorkerDeps } from "../orchestrator/steps/context.js";

export function makeWorkflowStartSubscriber(
  deps: WorkerDeps,
): EventSubscriberDef<WorkflowStartMessage> {
  return {
    event: WorkflowStartDefinition,
    routingKey: "start",
    queueName: Q_WORKFLOW_START,
    prefetch: 5,
    async consume(
      payload: WorkflowStartMessage,
      publisherChannel: ConfirmChannel,
    ) {
      await handleWorkflowStart(payload, deps, publisherChannel);
    },
  };
}
