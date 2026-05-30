import { nanoid } from "nanoid";
import type { Channel, ChannelModel } from "amqplib";
import type { PrismaClient } from "@workspace/db-adapter";
import { EX_RUN_EVENTS } from "@workspace/rmq";
import { RunEventSchema, RunSnapshotSchema, logger } from "@workspace/shared";
import { loadRunSnapshot } from "../lib/snapshot.js";

const encoder = new TextEncoder();

function sseData(payload: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
}

/**
 * SSE handler per DESIGN §13 — cross-process fanout via exclusive ephemeral queues.
 *
 * 1. Load DB snapshot → synthetic `snapshot` event
 * 2. Declare `sse.<connId>` (exclusive, auto-delete) bound to `run.<runId>.#`
 * 3. Forward each RMQ message as `data: <json>\n\n`
 * 4. On disconnect the queue is removed automatically
 */
export async function createRunStreamHandler(
  connection: ChannelModel,
  prisma: PrismaClient,
  runId: string,
): Promise<Response> {
  const snapshot = await loadRunSnapshot(prisma, runId);
  if (!snapshot) {
    return Response.json(
      { error: { code: "not_found", message: "Run not found" } },
      { status: 404 },
    );
  }

  const connId = nanoid();
  const queueName = `sse.${connId}`;
  const bindingKey = `run.${runId}.#`;

  let channel: Channel | null = null;
  let consumerTag: string | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(
        sseData({
          type: "snapshot",
          runId,
          payload: RunSnapshotSchema.parse(snapshot),
        }),
      );

      channel = await connection.createChannel();
      await channel.assertExchange(EX_RUN_EVENTS, "topic", { durable: true });
      await channel.assertQueue(queueName, {
        exclusive: true,
        autoDelete: true,
      });
      await channel.bindQueue(queueName, EX_RUN_EVENTS, bindingKey);

      const { consumerTag: tag } = await channel.consume(
        queueName,
        (msg) => {
          if (!msg) return;
          try {
            const raw = JSON.parse(msg.content.toString("utf8")) as unknown;
            const event = RunEventSchema.parse(raw);
            logger.info({ runId, connId, event }, "[sse] event received");
            controller.enqueue(sseData(event));
            channel?.ack(msg);
          } catch (err) {
            logger.warn(
              { err, runId, connId, msg },
              "[sse] invalid run event payload — discarding",
            );
            channel?.ack(msg);
          }
        },
        { noAck: false },
      );
      consumerTag = tag;

      logger.info({ runId, connId, queueName, bindingKey }, "[sse] stream connected");
    },
    async cancel() {
      try {
        if (channel && consumerTag) {
          await channel.cancel(consumerTag);
        }
        await channel?.close();
      } catch (err) {
        logger.warn({ err, runId, connId }, "[sse] cleanup error");
      }
      logger.info({ runId, connId, queueName }, "[sse] stream closed");
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
