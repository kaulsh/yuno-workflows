import { StepJobSchema, type StepJob } from "../schemas/messages.js";
import { EventDefinition, EventPublisher } from "../events.js";
import { EX_WORKFLOW_STEPS } from "../topology.js";

export const StepJobDefinition: EventDefinition<StepJob, "step"> = {
  name: "step_job",
  schema: StepJobSchema,
  routingKeys: ["step"] as const,
  exchangeName: EX_WORKFLOW_STEPS,
  exchangeType: "direct",
};

/**
 * Publisher factory for step job messages.
 *
 * Usage: `await StepJobPublisher(channel).publish(job, ['step'])`
 */
export const StepJobPublisher = EventPublisher(StepJobDefinition);
