import { CronExpressionParser } from "cron-parser";
import { logger } from "@workspace/shared";
import {
  WorkflowStartPublisher,
  type WorkflowStartMessage,
  type ConfirmChannel,
} from "@workspace/rmq";
import type { WorkerDeps } from "../orchestrator/steps/context.js";

const TICK_MS = 60_000;

/**
 * Singleton scheduler that fires scheduled workflows.
 *
 * On each tick (60s):
 *  - Fetches all workflows with triggerType = 'schedule'
 *  - Parses each cron expression via cron-parser
 *  - Checks if a fire time falls within the last 60s
 *  - If yes, publishes workflow.start
 *
 * Best-effort, 60s resolution, single-worker only.
 * Production would use a dedicated scheduler with distributed locking.
 */
export function startScheduler(
  { prisma }: WorkerDeps,
  publishChannel: ConfirmChannel,
): NodeJS.Timeout {
  logger.info("[scheduler] started (60s tick)");

  const tick = async () => {
    const now = Date.now();
    const windowStart = now - TICK_MS;

    try {
      const workflows = await prisma.workflow.findMany({
        where: { triggerType: "schedule" },
      });

      for (const wf of workflows) {
        const cfg = wf.triggerConfig as { source: string; cron?: string };
        if (cfg.source !== "schedule" || !cfg.cron) continue;

        try {
          const interval = CronExpressionParser.parse(cfg.cron, { tz: "UTC" });
          const prev = interval.prev();
          const fireMs = prev.toDate().getTime();

          if (fireMs >= windowStart && fireMs <= now) {
            const msg: WorkflowStartMessage = {
              workflowId: wf.id,
              triggerContext: {
                source: "schedule",
                firedAt: new Date(fireMs).toISOString(),
              },
            };
            await WorkflowStartPublisher(publishChannel).publish(msg, [
              "start",
            ]);
            logger.info(
              { workflowName: wf.name, cron: cfg.cron },
              `[scheduler] fired workflow "${wf.name}"`,
            );
          }
        } catch (err) {
          logger.error(
            { err, workflowName: wf.name },
            `[scheduler] error processing workflow "${wf.name}"`,
          );
        }
      }
    } catch (err) {
      logger.error({ err }, "[scheduler] tick error");
    }
  };

  void tick();

  return setInterval(tick, TICK_MS);
}
