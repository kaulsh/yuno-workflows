import amqplib, { type ChannelModel, type ConfirmChannel } from "amqplib";
import { logger } from "@workspace/shared";

export async function createConnection({
  uri,
}: {
  uri: string;
}): Promise<ChannelModel> {
  const conn = await amqplib.connect(uri);
  conn.on("error", (err) => logger.error({ err }, "[rmq] connection error"));
  conn.on("close", () => logger.warn("[rmq] connection closed"));
  return conn;
}

/**
 * Creates a confirm channel on an existing connection.
 *
 * Passing `queueName` asserts the queue durable before returning —
 * subscriber bootstrap uses this so the queue exists before binding.
 * Publisher-only channels omit `queueName`.
 */
export async function createChannel({
  connection,
  queueName,
}: {
  connection: ChannelModel;
  queueName?: string;
}): Promise<ConfirmChannel> {
  const ch = await connection.createConfirmChannel();
  if (queueName) {
    await ch.assertQueue(queueName, { durable: true });
  }
  return ch;
}

export type { ChannelModel, ConfirmChannel };
