import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@workspace/db-adapter";
import { logger } from "@workspace/shared";
import { createConnection, executeEventSubscriber } from "@workspace/rmq";
import { WorkflowStartSubscriber } from "./subscribers/workflow-start.subscriber.js";
import { StepJobSubscriber } from "./subscribers/step-job.subscriber.js";
import type { WorkerDeps } from "./orchestrator/steps/context.js";
import { MemoryService } from "./memory/index.js";
import {
  startTelegramBot,
  getSendTelegram,
  stopTelegramBot,
} from "./telegram/bot.js";
import { startScheduler } from "./scheduler/index.js";

const pool = new Pool({ connectionString: process.env["DATABASE_URL"] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const memoryService = new MemoryService(prisma);

const deps: WorkerDeps = {
  prisma,
  memoryService,
  getSendTelegram,
};

(async function main() {
  logger.info("[worker] starting");

  const rmqUrl = process.env["RABBITMQ_URL"] ?? "amqp://localhost";

  const conn = await createConnection({ uri: rmqUrl });

  const telegramToken = process.env["TELEGRAM_BOT_TOKEN"];
  if (telegramToken) {
    await startTelegramBot(
      telegramToken,
      prisma,
      await conn.createConfirmChannel(),
    );
  } else {
    logger.warn("[worker] TELEGRAM_BOT_TOKEN not set — Telegram bot disabled");
  }

  startScheduler(deps, await conn.createConfirmChannel());

  await Promise.all([
    executeEventSubscriber(conn, WorkflowStartSubscriber(deps)),
    executeEventSubscriber(conn, StepJobSubscriber(deps)),
  ]);

  logger.info("[worker] ready");

  const shutdown = async () => {
    logger.info("[worker] shutting down...");
    stopTelegramBot();
    await conn.close();
    await pool.end();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
})();
