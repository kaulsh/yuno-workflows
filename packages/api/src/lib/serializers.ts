import type {
  Agent as DbAgent,
  AgentTrace as DbTrace,
  Skill as DbSkill,
  Workflow as DbWorkflow,
  WorkflowMessage as DbMessage,
  WorkflowRun as DbRun,
  WorkflowStep as DbStep,
} from "@workspace/db-adapter";
import {
  AgentSchema,
  AgentTraceSchema,
  GuardrailsConfigSchema,
  MemoryConfigSchema,
  ModelIdSchema,
  SkillSchema,
  WorkflowMessageSchema,
  WorkflowRunSchema,
  WorkflowSchema,
  WorkflowStepSchema,
  type Agent,
  type AgentTrace,
  type Skill,
  type Workflow,
  type WorkflowMessage,
  type WorkflowRun,
  type WorkflowStep,
} from "@workspace/shared";

function toIso(d: Date): string {
  return d.toISOString();
}

function toNumber(d: { toString(): string } | number): number {
  return typeof d === "number" ? d : Number(d);
}

export function serializeAgent(row: DbAgent): Agent {
  return AgentSchema.parse({
    id: row.id,
    name: row.name,
    role: row.role,
    systemPrompt: row.systemPrompt,
    model: row.model,
    temperature: toNumber(row.temperature),
    maxOutputTokens: row.maxOutputTokens,
    tools: row.tools,
    skillIds: row.skillIds,
    memory: MemoryConfigSchema.parse(row.memory),
    guardrails: GuardrailsConfigSchema.parse(row.guardrails),
    channels: row.channels,
    scheduleCron: row.scheduleCron,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  });
}

export function serializeSkill(row: DbSkill): Skill {
  return SkillSchema.parse({
    id: row.id,
    name: row.name,
    description: row.description,
    instructions: row.instructions,
    requiredTools: row.requiredTools,
    createdAt: toIso(row.createdAt),
  });
}

export function serializeWorkflow(row: DbWorkflow): Workflow {
  return WorkflowSchema.parse({
    id: row.id,
    name: row.name,
    description: row.description,
    triggerType: row.triggerType,
    triggerConfig: row.triggerConfig,
    nodes: row.nodes,
    edges: row.edges,
    entryNodeId: row.entryNodeId,
    maxSteps: row.maxSteps,
    isTemplate: row.isTemplate,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  });
}

export function serializeRun(row: DbRun): WorkflowRun {
  return WorkflowRunSchema.parse({
    id: row.id,
    workflowId: row.workflowId,
    status: row.status,
    triggerContext: row.triggerContext,
    initialInput: row.initialInput,
    stepCount: row.stepCount,
    totalPromptTokens: row.totalPromptTokens,
    totalCompletionTokens: row.totalCompletionTokens,
    totalCostUsd: toNumber(row.totalCostUsd),
    startedAt: toIso(row.startedAt),
    completedAt: row.completedAt ? toIso(row.completedAt) : null,
    error: row.error,
  });
}

export function serializeStep(row: DbStep): WorkflowStep {
  return WorkflowStepSchema.parse({
    id: row.id,
    runId: row.runId,
    stepIndex: row.stepIndex,
    nodeId: row.nodeId,
    nodeType: row.nodeType,
    agentId: row.agentId,
    status: row.status,
    inputMessage: row.inputMessage,
    output: row.output,
    startedAt: toIso(row.startedAt),
    completedAt: row.completedAt ? toIso(row.completedAt) : null,
    error: row.error,
  });
}

export function serializeMessage(row: DbMessage): WorkflowMessage {
  return WorkflowMessageSchema.parse({
    id: row.id,
    runId: row.runId,
    fromStepId: row.fromStepId,
    toStepId: row.toStepId,
    fromAgentId: row.fromAgentId,
    toAgentId: row.toAgentId,
    channel: row.channel,
    content: row.content,
    createdAt: toIso(row.createdAt),
  });
}

export function serializeTrace(row: DbTrace): AgentTrace {
  return AgentTraceSchema.parse({
    id: row.id,
    runId: row.runId,
    stepId: row.stepId,
    agentId: row.agentId,
    model: ModelIdSchema.parse(row.model),
    promptTokens: row.promptTokens,
    completionTokens: row.completionTokens,
    costUsd: toNumber(row.costUsd),
    latencyMs: row.latencyMs,
    createdAt: toIso(row.createdAt),
  });
}
