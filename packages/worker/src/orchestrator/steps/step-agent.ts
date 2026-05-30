import type { PrismaClient } from "@workspace/db-adapter";
import type { Agent, ModelId } from "@workspace/shared";
import type { ConfirmChannel } from "@workspace/rmq";
import { emitRunEvent } from "../../lib/emit-run-event.js";
import { invokeAgent, type AgentNode } from "../../runtime/invoke-agent.js";
import type { RunContext } from "../../runtime/run-context.js";
import type { ExecuteAgentStepParams } from "./context.js";

export async function executeAgentStep({
  deps,
  run,
  step,
  node,
  input,
}: ExecuteAgentStepParams): Promise<Record<string, unknown>> {
  const { prisma, memoryService, publishChannel, sendTelegram } = deps;
  const { id: runId, triggerContext } = run;
  const { id: stepId, nodeId } = step;
  const { inboundMessage } = input;

  const agent = await prisma.agent.findUniqueOrThrow({
    where: { id: node.agentId },
  });

  const memCfg = agent.memory as {
    enabled: boolean;
    scope: string;
    strategy: "semantic" | "recency";
    k: number;
  };

  const memoryNamespace =
    memCfg.scope === "shared" ? `workflow_run:${runId}` : `agent:${agent.id}`;

  const ctx: RunContext = {
    runId,
    stepId,
    agentId: agent.id,
    model: agent.model as ModelId,
    memoryNamespace,
    triggerContext,
  };

  const agentNode: AgentNode = {
    task: node.task,
    outputSchema: node.outputSchema,
  };

  const { output, traces } = await invokeAgent(
    agent as unknown as Agent,
    agentNode,
    inboundMessage,
    ctx,
    {
      prisma,
      memoryService,
      sendTelegram: agent.channels.includes("telegram") ? sendTelegram : null,
      insertTrace: async (data) =>
        void (await prisma.agentTrace.create({
          data: { ...data, costUsd: data.costUsd },
        })),
      publishEvent: async (event) => {
        if (event.type === "snapshot") return;
        await emitRunEvent(prisma, publishChannel, event);
      },
    },
  );

  const stepOutput = output;

  await prisma.$transaction([
    prisma.workflowStep.update({
      where: { id: stepId },
      data: {
        status: "completed",
        output: stepOutput as object,
        completedAt: new Date(),
      },
    }),
    prisma.workflowRun.update({
      where: { id: runId },
      data: {
        totalPromptTokens: { increment: traces.promptTokens },
        totalCompletionTokens: { increment: traces.completionTokens },
        totalCostUsd: { increment: traces.costUsd },
      },
    }),
  ]);

  await persistMessage(prisma, publishChannel, {
    runId,
    fromStepId: stepId,
    fromAgentId: agent.id,
    content:
      typeof stepOutput.text === "string"
        ? stepOutput.text
        : JSON.stringify(stepOutput),
    channel: "internal",
  });

  await emitRunEvent(prisma, publishChannel, {
    type: "step.completed",
    runId,
    at: new Date().toISOString(),
    stepId,
    nodeId,
    output: stepOutput,
    tokens: {
      promptTokens: traces.promptTokens,
      completionTokens: traces.completionTokens,
    },
    costUsd: traces.costUsd,
  });

  return stepOutput;
}

async function persistMessage(
  prisma: PrismaClient,
  publishChannel: ConfirmChannel,
  data: {
    runId: string;
    fromStepId: string;
    fromAgentId: string;
    content: string;
    channel: string;
  },
): Promise<void> {
  await prisma.workflowMessage.create({
    data: {
      runId: data.runId,
      fromStepId: data.fromStepId,
      fromAgentId: data.fromAgentId,
      channel: data.channel,
      content: data.content,
    },
  });
  await emitRunEvent(prisma, publishChannel, {
    type: "message.sent",
    runId: data.runId,
    at: new Date().toISOString(),
    fromAgentId: data.fromAgentId,
    channel: data.channel as "internal" | "telegram",
    content: data.content,
  });
}
