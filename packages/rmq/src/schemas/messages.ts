import { z } from "zod";
import { TriggerContextSchema } from "@workspace/shared";
import { UuidSchema } from "@workspace/shared";

/**
 * RabbitMQ message contracts — shared between api (publisher) and worker (consumer).
 */

export const WorkflowStartSchema = z.object({
  workflowId: UuidSchema,
  runId: UuidSchema.optional(),
  initialInput: z.string().optional(),
  triggerContext: TriggerContextSchema,
});

export type WorkflowStartMessage = z.infer<typeof WorkflowStartSchema>;

export const StepJobSchema = z.object({
  runId: UuidSchema,
  currentNodeId: z.string().min(1),
  inboundMessage: z.string(),
  stepIndex: z.number().int().nonnegative(),
});

export type StepJob = z.infer<typeof StepJobSchema>;
