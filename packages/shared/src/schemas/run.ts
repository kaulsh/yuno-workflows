import { z } from "zod";

import { parseStoredRunEvent, type StoredRunEvent } from "../events.js";
import { ChannelSchema, ModelIdSchema } from "./agent.js";
import {
  IsoDateTimeSchema,
  JsonValueSchema,
  UuidSchema,
} from "./common.js";

export const RunStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const StepStatusSchema = z.enum(["running", "completed", "failed"]);

export const NodeTypeSchema = z.enum(["agent", "condition", "end"]);

export const TriggerContextSchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("manual") }),
  z.object({
    source: z.literal("telegram"),
    chatId: z.union([z.string(), z.number()]),
    userId: z.union([z.string(), z.number()]),
  }),
  z.object({
    source: z.literal("schedule"),
    firedAt: IsoDateTimeSchema,
  }),
]);

export const WorkflowRunSchema = z.object({
  id: UuidSchema,
  workflowId: UuidSchema,
  status: RunStatusSchema,
  triggerContext: TriggerContextSchema,
  initialInput: z.string().nullable(),
  stepCount: z.number().int().nonnegative(),
  totalPromptTokens: z.number().int().nonnegative(),
  totalCompletionTokens: z.number().int().nonnegative(),
  totalCostUsd: z.number().nonnegative(),
  startedAt: IsoDateTimeSchema,
  completedAt: IsoDateTimeSchema.nullable(),
  error: z.string().nullable(),
});

export const WorkflowStepSchema = z.object({
  id: UuidSchema,
  runId: UuidSchema,
  stepIndex: z.number().int().nonnegative(),
  nodeId: z.string().min(1),
  nodeType: NodeTypeSchema,
  agentId: UuidSchema.nullable().optional(),
  status: StepStatusSchema,
  inputMessage: z.string().nullable().optional(),
  output: JsonValueSchema.nullable().optional(),
  startedAt: IsoDateTimeSchema,
  completedAt: IsoDateTimeSchema.nullable().optional(),
  error: z.string().nullable().optional(),
});

export const WorkflowMessageSchema = z.object({
  id: UuidSchema,
  runId: UuidSchema,
  fromStepId: UuidSchema.nullable().optional(),
  toStepId: UuidSchema.nullable().optional(),
  fromAgentId: UuidSchema.nullable().optional(),
  toAgentId: UuidSchema.nullable().optional(),
  channel: ChannelSchema,
  content: z.string(),
  createdAt: IsoDateTimeSchema,
});

export const AgentTraceSchema = z.object({
  id: UuidSchema,
  runId: UuidSchema,
  stepId: UuidSchema,
  agentId: UuidSchema,
  model: ModelIdSchema,
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative(),
  latencyMs: z.number().int().nonnegative(),
  createdAt: IsoDateTimeSchema,
});

export const RunSnapshotSchema = z.object({
  run: WorkflowRunSchema,
  steps: z.array(WorkflowStepSchema),
  messages: z.array(WorkflowMessageSchema),
  traces: z.array(AgentTraceSchema),
  events: z.array(
    z.custom<StoredRunEvent>((val) => {
      parseStoredRunEvent(val);
      return true;
    }),
  ),
});

export const ListRunsQuerySchema = z.object({
  workflowId: UuidSchema.optional(),
  status: RunStatusSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  cursor: UuidSchema.optional(),
});

export const TokenUsageSchema = z.object({
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
});

export type RunStatus = z.infer<typeof RunStatusSchema>;
export type StepStatus = z.infer<typeof StepStatusSchema>;
export type NodeType = z.infer<typeof NodeTypeSchema>;
export type TriggerContext = z.infer<typeof TriggerContextSchema>;
export type WorkflowRun = z.infer<typeof WorkflowRunSchema>;
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;
export type WorkflowMessage = z.infer<typeof WorkflowMessageSchema>;
export type AgentTrace = z.infer<typeof AgentTraceSchema>;
export type RunSnapshot = z.infer<typeof RunSnapshotSchema>;
export type ListRunsQuery = z.infer<typeof ListRunsQuerySchema>;
export type TokenUsage = z.infer<typeof TokenUsageSchema>;
