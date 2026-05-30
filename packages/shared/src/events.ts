import { z } from "zod";

import { ChannelSchema } from "./schemas/agent.js";
import {
  IsoDateTimeSchema,
  JsonValueSchema,
  UuidSchema,
} from "./schemas/common.js";
import { TokenUsageSchema } from "./schemas/run.js";

const runEventBase = {
  runId: UuidSchema,
  at: IsoDateTimeSchema,
};

export const RunEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("snapshot"),
    runId: UuidSchema,
    /** Validated at API/SSE boundaries via `RunSnapshotSchema`. */
    payload: z.unknown(),
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
    stepId: UuidSchema.optional().nullable(),
    nodeId: z.string().min(1).optional().nullable(),
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

/** Run events persisted in DB and streamed live (excludes the synthetic snapshot). */
export type StoredRunEvent = Exclude<RunEvent, { type: "snapshot" }>;

export function parseStoredRunEvent(payload: unknown): StoredRunEvent {
  const event = RunEventSchema.parse(payload);
  if (event.type === "snapshot") {
    throw new Error("snapshot events are not stored");
  }
  return event;
}

export const StoredRunEventSchema: z.ZodType<StoredRunEvent> =
  RunEventSchema.refine((e): e is StoredRunEvent => e.type !== "snapshot");
