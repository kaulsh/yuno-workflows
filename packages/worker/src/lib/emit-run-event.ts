import type { Prisma, PrismaClient } from "@workspace/db-adapter";
import { publishRunEvent, type ConfirmChannel } from "@workspace/rmq";
import {
  RunEventSchema,
  logger,
  type StoredRunEvent,
} from "@workspace/shared";

/**
 * Dual-writes a run event per DESIGN §13: persisted to DB (source of truth),
 * then published to RMQ for live SSE consumers (best effort).
 */
export async function emitRunEvent(
  prisma: PrismaClient,
  channel: ConfirmChannel,
  event: StoredRunEvent,
): Promise<void> {
  const validated = RunEventSchema.parse(event) as StoredRunEvent;

  await prisma.workflowRunEvent.create({
    data: {
      runId: validated.runId,
      type: validated.type,
      payload: validated as Prisma.InputJsonValue,
      at: new Date(validated.at),
    },
  });

  try {
    await publishRunEvent(channel, validated.runId, validated);
  } catch (err) {
    logger.error(
      { err, runId: validated.runId, type: validated.type },
      "[run-event] failed to publish to RMQ",
    );
  }
}
