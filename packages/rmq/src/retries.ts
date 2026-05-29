import type { ConfirmChannel, ConsumeMessage } from "amqplib";

/**
 * Delay ladder for non-RetryException errors (1s / 5s / 25s).
 * The index into this array is the current death count.
 */
export const DELAYS_MS = [1_000, 5_000, 25_000] as const;

/**
 * Application-level retry counter stored in message headers.
 * Distinct from RabbitMQ's built-in x-death header, which we do not use
 * for counting. Using our own keeps the counter stable across re-queues.
 */
export const DEATH_COUNT_HEADER = "x-retry-death-count";

/**
 * x-expires on the retry exchange itself. 
 * Idle retry infrastructure is cleaned up by the broker after 3 days.
 */
const RETRY_EXCHANGE_TTL_MS = 3 * 24 * 60 * 60 * 1_000;

export function messageDeathCount(msg: ConsumeMessage): number {
  const headers = msg.properties.headers as Record<string, unknown> | null;
  const count = headers?.[DEATH_COUNT_HEADER];
  return typeof count === "number" ? count : 0;
}

/**
 * Asserts a per-event retry exchange (topic, auto-expires when idle).
 * Returns the retry exchange name.
 */
export async function assertRetryExchange(
  channel: ConfirmChannel,
  exchangeName: string,
): Promise<string> {
  const retryExchangeName = `${exchangeName}.retry`;
  await channel.assertExchange(retryExchangeName, "topic", {
    durable: true,
    autoDelete: false,
    arguments: { "x-expires": RETRY_EXCHANGE_TTL_MS },
  });
  return retryExchangeName;
}

/**
 * Asserts a TTL-based retry queue for a specific delay tier.
 *
 * After `delayMs` the message dead-letters back to the main event exchange
 * (and original routing key if provided), landing on the same subscriber
 * queue for re-delivery.
 *
 * The queue is `autoDelete: true` with `x-expires = delayMs * 2` so idle
 * retry infrastructure is cleaned up by the broker automatically.
 */
export async function assertRetryQueue(
  channel: ConfirmChannel,
  queueName: string,
  exchangeName: string,
  delayMs: number,
  routingKey?: string,
): Promise<string> {
  const retryQueueName = `${queueName}.retry.${delayMs}`;
  const args: Record<string, unknown> = {
    "x-message-ttl": delayMs,
    "x-expires": delayMs * 2,
    "x-dead-letter-exchange": exchangeName,
  };
  if (routingKey) args["x-dead-letter-routing-key"] = routingKey;

  await channel.assertQueue(retryQueueName, {
    durable: true,
    autoDelete: true,
    arguments: args,
  });
  return retryQueueName;
}

/**
 * Publishes a copy of `message` to the retry pipeline and waits for broker ack.
 *
 * The retry exchange routing key is the delay in ms (as a string). Each
 * failure tier may create/bind a distinct retry queue for that delay.
 */
export async function publishRetryMessage(
  channel: ConfirmChannel,
  retryQueue: string,
  retryExchange: string,
  delay: number,
  deathCount: number,
  message: ConsumeMessage,
): Promise<void> {
  await channel.bindQueue(retryQueue, retryExchange, String(delay));
  channel.publish(
    retryExchange,
    String(delay),
    message.content,
    {
      messageId: message.properties.messageId,
      persistent: true,
      headers: { [DEATH_COUNT_HEADER]: deathCount + 1 },
    },
  );
  await channel.waitForConfirms();
}
