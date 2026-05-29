import { nanoid } from "nanoid";
import type { ChannelModel, ConfirmChannel, ConsumeMessage } from "amqplib";
import { logger } from "@workspace/shared";
import {
  DELAYS_MS,
  messageDeathCount,
  assertRetryExchange,
  assertRetryQueue,
  publishRetryMessage,
} from "./retries.js";
import { DiscardException } from "./errors/discard-exception.js";
import { RetryException } from "./errors/retry-exception.js";

/** Minimal schema contract — duck-typed so any Zod schema satisfies it. */
export interface Schema<T> {
  parse(data: unknown): T;
}

/**
 * Named, Zod-typed event contract.
 *
 * `routingKeys` constrains what routing keys subscribers may bind — TypeScript
 * surfaces a type error if a subscriber tries to bind a key not declared here.
 * For dynamic routing keys (e.g. `run.<runId>.#`), leave `routingKeys` empty
 * and pass `opts.routingKey` to `executeEventSubscriber`.
 *
 * `exchangeName` is required and must match the exchange declared in
 * `declareWorkflowTopology`. We bypass the naming-convention generator from
 * the source monorepo and hardcode DESIGN.md names directly.
 */
export interface EventDefinition<T, K extends string = string> {
  name: string;
  schema: Schema<T>;
  routingKeys: readonly K[];
  exchangeName: string;
  exchangeType?: "direct" | "topic" | "fanout";
}

/**
 * Returns a publisher factory for a given event definition.
 *
 * Usage:
 * ```ts
 * const WorkflowStartPublisher = EventPublisher(WorkflowStartDefinition);
 * await WorkflowStartPublisher(channel).publish(payload, ['start']);
 * ```
 *
 * Uses a confirm channel — `publish` resolves only after the broker acks.
 */
export function EventPublisher<T, K extends string>(
  definition: EventDefinition<T, K>,
) {
  return (channel: ConfirmChannel) => ({
    async publish(payload: T, keys: readonly (K | string)[]): Promise<void> {
      const validated = definition.schema.parse(payload);
      const routingKey = keys.join(".");
      const messageId = nanoid();
      logger.info(
        { exchange: definition.exchangeName, routingKey, messageId },
        `[rmq:pub] ${definition.name}`,
      );
      channel.publish(
        definition.exchangeName,
        routingKey,
        Buffer.from(JSON.stringify(validated), "utf8"),
        { messageId, persistent: true, contentType: "application/json" },
      );
      await channel.waitForConfirms();
    },
  });
}

export interface ConsumeContext {
  messageId: string;
  retryCount: number;
}

export interface EventSubscriberDef<T> {
  event: EventDefinition<T, string>;
  /** Routing key to bind. Can include AMQP wildcards (* #). */
  routingKey: string;
  /** Queue to assert and consume from. */
  queueName: string;
  /** Channel prefetch count. Defaults to 1. */
  prefetch?: number;
  consume: (
    payload: T,
    publisherChannel: ConfirmChannel,
    ctx: ConsumeContext,
  ) => Promise<void>;
}

export interface SubscribeOptions {
  /** Override queue durability. Default: true. */
  durable?: boolean;
  /** Exclusive queue (only one consumer). Default: false. */
  exclusive?: boolean;
  /** Auto-delete queue when last consumer disconnects. Default: false. */
  autoDelete?: boolean;
  /** Override queue name (required for transient/SSE queues). */
  queueName?: string;
  /** Override routing key (needed for wildcard SSE bindings). */
  routingKey?: string;
  /** Set to false to disable the TTL retry pipeline. Default: true. */
  enableRetry?: boolean;
  /**
   * Hard cap on retry attempts before the message is discarded to DLX.
   * Defaults to DELAYS_MS.length (3 for the 1s/5s/25s ladder).
   */
  maxRetries?: number;
}

/**
 * Bootstraps one subscriber on a dedicated channel pair (consumer + publisher).
 *
 * - Consumer channel: prefetch-limited, consumes `queueName`.
 * - Publisher channel: a second confirm channel passed to each `consume`
 *   handler so handlers can chain-publish events without blocking consumer ack.
 * - On channel `error`: recursively restarts the subscriber (new channels +
 *   new binding + new consumer).
 *
 * For transient (SSE) subscribers, pass `opts` with `durable: false`,
 * `exclusive: true`, `autoDelete: true`, `enableRetry: false`, and a unique
 * `queueName` per connection. The returned cleanup function closes both
 * channels; the auto-delete queue is then removed by the broker.
 *
 * @returns A cleanup function that closes the channels.
 */
export async function executeEventSubscriber<T>(
  connection: ChannelModel,
  subscriber: EventSubscriberDef<T>,
  opts?: SubscribeOptions,
): Promise<() => Promise<void>> {
  const queueName = opts?.queueName ?? subscriber.queueName;
  const routingKey = opts?.routingKey ?? subscriber.routingKey;
  const durable = opts?.durable ?? true;
  const exclusive = opts?.exclusive ?? false;
  const autoDelete = opts?.autoDelete ?? false;
  const enableRetry = opts?.enableRetry ?? true;
  const maxRetries = opts?.maxRetries ?? DELAYS_MS.length;
  const exchangeName = subscriber.event.exchangeName;
  const exchangeType = subscriber.event.exchangeType ?? "topic";

  logger.info(
    { queueName, exchangeName, routingKey },
    `[rmq:sub] starting ${subscriber.event.name}`,
  );

  const ch = await connection.createConfirmChannel();
  await ch.assertExchange(exchangeName, exchangeType, {
    durable: true,
    autoDelete: false,
  });
  await ch.assertQueue(queueName, { durable, exclusive, autoDelete });
  await ch.bindQueue(queueName, exchangeName, routingKey);
  await ch.prefetch(subscriber.prefetch ?? 1);

  ch.on("error", (err: Error) => {
    logger.error(
      { err },
      `[rmq:sub] channel error for ${subscriber.event.name} — restarting`,
    );
    void executeEventSubscriber(connection, subscriber, opts);
  });

  const publisherChannel = await connection.createConfirmChannel();

  await ch.consume(queueName, async (msg: ConsumeMessage | null) => {
    if (!msg) return;

    const messageId = msg.properties.messageId ?? nanoid();
    const retryCount = messageDeathCount(msg);

    let payload: T;
    try {
      payload = subscriber.event.schema.parse(
        JSON.parse(msg.content.toString()),
      ) as T;
    } catch (parseErr) {
      logger.error(
        { err: parseErr, messageId },
        `[rmq:sub] schema parse error — discarding`,
      );
      ch.reject(msg, false);
      return;
    }

    try {
      logger.info(
        { messageId, queueName, retryCount },
        `[rmq:sub] consuming ${subscriber.event.name}`,
      );
      await subscriber.consume(payload, publisherChannel, {
        messageId,
        retryCount,
      });
      ch.ack(msg);
    } catch (err) {
      if (err instanceof DiscardException) {
        logger.info(
          { messageId, reason: (err as Error).message },
          `[rmq:sub] discarding message`,
        );
        ch.reject(msg, false);
        return;
      }

      logger.error({ err, messageId, queueName }, `[rmq:sub] handler error`);

      if (!enableRetry || retryCount >= maxRetries) {
        logger.error(
          { messageId, retryCount, maxRetries },
          `[rmq:sub] retry budget exhausted — sending to DLX`,
        );
        ch.reject(msg, false);
        return;
      }

      const delay =
        err instanceof RetryException
          ? err.delayMs
          : DELAYS_MS[Math.min(retryCount, DELAYS_MS.length - 1)]!;

      try {
        const retryQueue = await assertRetryQueue(
          ch,
          queueName,
          exchangeName,
          delay,
          routingKey,
        );
        const retryExchange = await assertRetryExchange(ch, exchangeName);
        await publishRetryMessage(
          ch,
          retryQueue,
          retryExchange,
          delay,
          retryCount,
          msg,
        );
        ch.ack(msg);
        logger.info(
          { messageId, delay, retryCount, retryQueue },
          `[rmq:sub] retry scheduled`,
        );
      } catch (retryErr) {
        logger.error(
          { err: retryErr },
          `[rmq:sub] failed to schedule retry — nacking`,
        );
        ch.nack(msg, false, false);
      }
    }
  });

  return async () => {
    try {
      await ch.close();
    } catch {
      /* already closed */
    }
    try {
      await publisherChannel.close();
    } catch {
      /* already closed */
    }
  };
}
