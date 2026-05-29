import { nanoid } from "nanoid";
import { RunEventSchema, type RunEvent } from "@workspace/shared";
import { EX_RUN_EVENTS } from "../topology.js";
import type { ConfirmChannel } from "amqplib";

/**
 * Publishes a Zod-validated run event to the `run.events` topic exchange.
 *
 * Routing key: `run.<runId>.<event.type>`
 *
 * SSE consumers bind with `run.<runId>.#` to receive only events for a
 * specific run — broker-level filtering, no application-layer fan-out.
 *
 * This is a raw publish helper rather than an EventPublisher because the
 * routing key is dynamic (contains runId). EventPublisher/EventSubscriber
 * abstractions are best suited for static routing keys (workflow.start,
 * workflow.steps). See `events.ts` comments and DESIGN §13 for rationale.
 *
 */
export async function publishRunEvent(
  channel: ConfirmChannel,
  runId: string,
  event: RunEvent,
): Promise<void> {
  const validated = RunEventSchema.parse(event);
  const routingKey = `run.${runId}.${validated.type}`;
  const messageId = nanoid();
  channel.publish(
    EX_RUN_EVENTS,
    routingKey,
    Buffer.from(JSON.stringify(validated), "utf8"),
    { messageId, persistent: true, contentType: "application/json" },
  );
  await channel.waitForConfirms();
}
