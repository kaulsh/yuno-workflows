import { z } from "zod";

import { MODEL_IDS } from "../prices.js";
import { IsoDateTimeSchema, UuidSchema } from "./common.js";

export const ChannelSchema = z.enum(["internal", "telegram"]);
export type Channel = z.infer<typeof ChannelSchema>;

export const MemoryScopeSchema = z.enum(["private", "shared"]);
export const MemoryStrategySchema = z.enum(["semantic", "recency"]);

export const MemoryConfigSchema = z.object({
  enabled: z.boolean(),
  scope: MemoryScopeSchema,
  strategy: MemoryStrategySchema,
  k: z.number().int().positive(),
});

export const GuardrailsConfigSchema = z.object({
  inputDenylist: z.array(z.string()).default([]),
  outputDenylist: z.array(z.string()).default([]),
  piiRedaction: z.boolean().default(false),
});

export const ModelIdSchema = z.enum(MODEL_IDS);

export const AgentSchema = z.object({
  id: UuidSchema,
  name: z.string().min(1),
  role: z.string().min(1),
  systemPrompt: z.string(),
  model: ModelIdSchema,
  temperature: z.number().min(0).max(2),
  maxOutputTokens: z.number().int().positive(),
  tools: z.array(z.string()).default([]),
  skillIds: z.array(UuidSchema).default([]),
  memory: MemoryConfigSchema,
  guardrails: GuardrailsConfigSchema,
  channels: z.array(ChannelSchema).default(["internal"]),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const CreateAgentInputSchema = AgentSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateAgentInputSchema = CreateAgentInputSchema;

export type Agent = z.infer<typeof AgentSchema>;
export type CreateAgentInput = z.infer<typeof CreateAgentInputSchema>;
export type UpdateAgentInput = z.infer<typeof UpdateAgentInputSchema>;
export type MemoryConfig = z.infer<typeof MemoryConfigSchema>;
export type GuardrailsConfig = z.infer<typeof GuardrailsConfigSchema>;
