import type { EventSubscriberDef } from "@workspace/rmq";
import { StepJobDefinition } from "@workspace/rmq";
import type { StepJob } from "@workspace/rmq";
import type { ConfirmChannel } from "amqplib";
import { processStepJob } from "../orchestrator/run-step.js";
import type { WorkerDeps } from "../orchestrator/steps/context.js";

export function StepJobSubscriber(
  deps: WorkerDeps,
): EventSubscriberDef<StepJob> {
  const { prisma, memoryService, getSendTelegram } = deps;

  return {
    event: StepJobDefinition,
    routingKey: "step",
    prefetch: 5,
    async consume(payload: StepJob, publisherChannel: ConfirmChannel) {
      await processStepJob(payload, {
        prisma,
        memoryService,
        publishChannel: publisherChannel,
        sendTelegram: getSendTelegram(),
      });
    },
  };
}
