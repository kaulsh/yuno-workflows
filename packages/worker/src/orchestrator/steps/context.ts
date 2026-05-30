import type { PrismaClient } from "@workspace/db-adapter";
import type { ConfirmChannel } from "@workspace/rmq";
import type { TriggerContext, WorkflowNode } from "@workspace/shared";
import type { MemoryService } from "../../memory/index.js";

export type SendTelegramFn = (chatId: string, text: string) => Promise<void>;

/** Worker-wide services wired in main and passed into subscribers. */
export interface WorkerDeps {
  prisma: PrismaClient;
  memoryService: MemoryService;
  getSendTelegram: () => SendTelegramFn | null;
}

/** Full orchestrator context for a single step execution. */
export interface OrchestratorDeps {
  prisma: PrismaClient;
  memoryService: MemoryService;
  publishChannel: ConfirmChannel;
  sendTelegram: SendTelegramFn | null;
}

/** Workflow run fields needed while executing a step. */
export interface WorkflowRunContext {
  id: string;
  triggerContext: TriggerContext;
}

/** Workflow run fields needed to finalize a completed run. */
export interface WorkflowRunCompletionContext {
  id: string;
  startedAt: Date;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalCostUsd: unknown;
}

/** Workflow step fields for the step currently being executed. */
export interface WorkflowStepContext {
  id: string;
  nodeId: string;
  stepIndex: number;
}

/** Inbound payload for the current step job. */
export interface StepJobInput {
  inboundMessage: string;
}

export type AgentWorkflowNode = Extract<WorkflowNode, { type: "agent" }>;
export type ConditionWorkflowNode = Extract<
  WorkflowNode,
  { type: "condition" }
>;

export interface ExecuteAgentStepParams {
  deps: OrchestratorDeps;
  run: WorkflowRunContext;
  step: WorkflowStepContext;
  node: AgentWorkflowNode;
  input: StepJobInput;
}

export interface ExecuteConditionStepParams {
  deps: OrchestratorDeps;
  run: Pick<WorkflowRunContext, "id">;
  step: WorkflowStepContext;
  node: ConditionWorkflowNode;
}

export interface ExecuteEndStepParams {
  deps: OrchestratorDeps;
  run: WorkflowRunCompletionContext;
  step: Pick<WorkflowStepContext, "id" | "nodeId">;
}
