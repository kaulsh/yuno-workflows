import {
  WorkflowStartSchema,
  type WorkflowStartMessage,
} from "../schemas/messages.js";
import { EventDefinition, EventPublisher } from "../events.js";
import { EX_WORKFLOW_START } from "../topology.js";

export const WorkflowStartDefinition: EventDefinition<
  WorkflowStartMessage,
  "start"
> = {
  name: "workflow_start",
  schema: WorkflowStartSchema,
  routingKeys: ["start"] as const,
  exchangeName: EX_WORKFLOW_START,
  exchangeType: "direct",
};

/**
 * Publisher factory for workflow.start events.
 *
 * Usage: `await WorkflowStartPublisher(channel).publish(msg, ['start'])`
 */
export const WorkflowStartPublisher = EventPublisher(WorkflowStartDefinition);
