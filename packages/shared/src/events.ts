import { z } from "zod";

import { ChannelSchema } from "./schemas/agent.js";
import {
  IsoDateTimeSchema,
  JsonValueSchema,
  UuidSchema,
} from "./schemas/common.js";
import { RunSnapshotSchema, TokenUsageSchema } from "./schemas/run.js";

const runEventBase = {
  runId: UuidSchema,
  at: IsoDateTimeSchema,
};

export const RunEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("snapshot"),
    runId: UuidSchema,
    payload: RunSnapshotSchema,
  }),
  z.object({
    type: z.literal("step.started"),
    ...runEventBase,
    stepId: UuidSchema,
    nodeId: z.string().min(1),
    agentId: UuidSchema.optional(),
  }),
  z.object({
    type: z.literal("step.completed"),
    ...runEventBase,
    stepId: UuidSchema,
    nodeId: z.string().min(1),
    output: JsonValueSchema,
    tokens: TokenUsageSchema,
    costUsd: z.number().nonnegative(),
  }),
  z.object({
    type: z.literal("step.failed"),
    ...runEventBase,
    stepId: UuidSchema,
    nodeId: z.string().min(1),
    error: z.string(),
  }),
  z.object({
    type: z.literal("tool.called"),
    ...runEventBase,
    stepId: UuidSchema,
    toolName: z.string().min(1),
    input: JsonValueSchema,
  }),
  z.object({
    type: z.literal("tool.result"),
    ...runEventBase,
    stepId: UuidSchema,
    toolName: z.string().min(1),
    output: JsonValueSchema,
  }),
  z.object({
    type: z.literal("message.sent"),
    ...runEventBase,
    fromAgentId: UuidSchema,
    toAgentId: UuidSchema.optional(),
    channel: ChannelSchema,
    content: z.string(),
  }),
  z.object({
    type: z.literal("run.completed"),
    ...runEventBase,
    totalTokens: z.number().int().nonnegative(),
    totalCostUsd: z.number().nonnegative(),
    durationMs: z.number().int().nonnegative(),
  }),
]);

export type RunEvent = z.infer<typeof RunEventSchema>;
export type RunEventType = RunEvent["type"];
