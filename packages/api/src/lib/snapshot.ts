import type { PrismaClient } from "@workspace/db-adapter";
import { parseStoredRunEvent, type RunSnapshot } from "@workspace/shared";
import {
  serializeMessage,
  serializeRun,
  serializeStep,
  serializeTrace,
} from "./serializers.js";

export async function loadRunSnapshot(
  prisma: PrismaClient,
  runId: string,
): Promise<RunSnapshot | null> {
  const run = await prisma.workflowRun.findUnique({
    where: { id: runId },
    include: {
      steps: { orderBy: { stepIndex: "asc" } },
      messages: { orderBy: { createdAt: "asc" } },
      traces: { orderBy: { createdAt: "asc" } },
      events: { orderBy: { at: "asc" } },
    },
  });

  if (!run) return null;

  return {
    run: serializeRun(run),
    steps: run.steps.map(serializeStep),
    messages: run.messages.map(serializeMessage),
    traces: run.traces.map(serializeTrace),
    events: run.events.map((row) => parseStoredRunEvent(row.payload)),
  };
}
