import { type TriggerContext } from "@workspace/shared";
import type { ModelId } from "@workspace/shared";

/**
 * Runtime context propagated through every agent invocation and tool call.
 * Populated by the orchestrator from the current step's run/agent state.
 */
export interface RunContext {
  runId: string;
  stepId: string;
  agentId: string;
  model: ModelId;
  memoryNamespace: string;
  triggerContext: TriggerContext;
}
