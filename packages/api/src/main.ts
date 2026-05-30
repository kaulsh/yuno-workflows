import { serve } from "@hono/node-server";
import { createChannel, createConnection } from "@workspace/rmq";
import { logger } from "@workspace/shared";
import { createApp } from "./app.js";
import { disconnectPrisma, prisma } from "./lib/prisma.ts";

const port = Number(process.env["PORT"] ?? 3000);
const rmqUrl = process.env["RABBITMQ_URL"] ?? "amqp://localhost";

const rmq = await createConnection({ uri: rmqUrl });

const publishChannel = await createChannel({ connection: rmq });

const app = createApp({ prisma, rmq, publishChannel });

serve({ fetch: app.fetch, port }, (info) => {
  logger.info(`[api] listening on http://localhost:${info.port}`);
});

async function shutdown(): Promise<void> {
  logger.info("[api] shutting down...");
  await publishChannel.close();
  await rmq.close();
  await disconnectPrisma();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
