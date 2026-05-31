import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import type { CopyBlock, CopyField } from "./parse-pg-copy.js";
import {
  parseBool,
  parseDate,
  parseDecimal,
  parseIntField,
  optionalJson,
  parseJson,
  parseOptionalDate,
  parseOptionalString,
  parsePgArray,
  parseString,
} from "./coerce.js";

function rowMap(block: CopyBlock): Map<string, CopyField>[] {
  return block.rows.map((cells, rowIndex) => {
    if (cells.length !== block.columns.length) {
      throw new Error(
        `seed: ${block.table} row ${rowIndex} has ${cells.length} fields, expected ${block.columns.length}`,
      );
    }
    const map = new Map<string, CopyField>();
    block.columns.forEach((col, i) => {
      map.set(col, cells[i] ?? null);
    });
    return map;
  });
}

function get(map: Map<string, CopyField>, key: string): string | null {
  const v = map.get(key);
  return v === undefined ? null : v;
}

export async function applyCopyBlocks(
  prisma: PrismaClient,
  blocks: CopyBlock[],
): Promise<void> {
  const byTable = new Map(blocks.map((b) => [b.table, b]));

  const skill = byTable.get("Skill");
  const agent = byTable.get("Agent");
  const workflow = byTable.get("Workflow");
  const workflowRun = byTable.get("WorkflowRun");
  const workflowStep = byTable.get("WorkflowStep");
  const workflowMessage = byTable.get("WorkflowMessage");
  const agentTrace = byTable.get("AgentTrace");
  const workflowRunEvent = byTable.get("WorkflowRunEvent");
  const memory = byTable.get("Memory");

  if (
    !skill ||
    !agent ||
    !workflow ||
    !workflowRun ||
    !workflowStep ||
    !workflowMessage ||
    !agentTrace ||
    !workflowRunEvent ||
    !memory
  ) {
    const missing = [
      "Skill",
      "Agent",
      "Workflow",
      "WorkflowRun",
      "WorkflowStep",
      "WorkflowMessage",
      "AgentTrace",
      "WorkflowRunEvent",
      "Memory",
    ].filter((t) => !byTable.has(t));
    throw new Error(`seed: data.sql missing tables: ${missing.join(", ")}`);
  }

  await prisma.skill.createMany({
    data: rowMap(skill).map((r) => ({
      id: parseString(get(r, "id")),
      name: parseString(get(r, "name")),
      description: parseString(get(r, "description")),
      instructions: parseString(get(r, "instructions")),
      requiredTools: parsePgArray(get(r, "requiredTools")),
      createdAt: parseDate(get(r, "createdAt")),
    })),
  });

  await prisma.agent.createMany({
    data: rowMap(agent).map((r) => ({
      id: parseString(get(r, "id")),
      name: parseString(get(r, "name")),
      role: parseString(get(r, "role")),
      systemPrompt: parseString(get(r, "systemPrompt")),
      model: parseString(get(r, "model")),
      temperature: parseDecimal(get(r, "temperature")),
      maxOutputTokens: parseIntField(get(r, "maxOutputTokens")),
      tools: parsePgArray(get(r, "tools")),
      skillIds: parsePgArray(get(r, "skillIds")),
      memory: parseJson(get(r, "memory")),
      guardrails: parseJson(get(r, "guardrails")),
      channels: parsePgArray(get(r, "channels")),
      createdAt: parseDate(get(r, "createdAt")),
      updatedAt: parseDate(get(r, "updatedAt")),
    })),
  });

  await prisma.workflow.createMany({
    data: rowMap(workflow).map((r) => ({
      id: parseString(get(r, "id")),
      name: parseString(get(r, "name")),
      description: parseString(get(r, "description")),
      triggerType: parseString(get(r, "triggerType")),
      triggerConfig: parseJson(get(r, "triggerConfig")),
      nodes: parseJson(get(r, "nodes")),
      edges: parseJson(get(r, "edges")),
      entryNodeId: parseString(get(r, "entryNodeId")),
      maxSteps: parseIntField(get(r, "maxSteps")),
      isTemplate: parseBool(get(r, "isTemplate")),
      createdAt: parseDate(get(r, "createdAt")),
      updatedAt: parseDate(get(r, "updatedAt")),
    })),
  });

  await prisma.workflowRun.createMany({
    data: rowMap(workflowRun).map((r) => ({
      id: parseString(get(r, "id")),
      workflowId: parseString(get(r, "workflowId")),
      status: parseString(get(r, "status")),
      triggerContext: parseJson(get(r, "triggerContext")),
      initialInput: parseOptionalString(get(r, "initialInput")),
      stepCount: parseIntField(get(r, "stepCount")),
      totalPromptTokens: parseIntField(get(r, "totalPromptTokens")),
      totalCompletionTokens: parseIntField(get(r, "totalCompletionTokens")),
      totalCostUsd: parseDecimal(get(r, "totalCostUsd")),
      startedAt: parseDate(get(r, "startedAt")),
      completedAt: parseOptionalDate(get(r, "completedAt")),
      error: parseOptionalString(get(r, "error")),
    })),
  });

  await prisma.workflowStep.createMany({
    data: rowMap(workflowStep).map((r) => ({
      id: parseString(get(r, "id")),
      runId: parseString(get(r, "runId")),
      stepIndex: parseIntField(get(r, "stepIndex")),
      nodeId: parseString(get(r, "nodeId")),
      nodeType: parseString(get(r, "nodeType")),
      agentId: parseOptionalString(get(r, "agentId")),
      status: parseString(get(r, "status")),
      inputMessage: parseOptionalString(get(r, "inputMessage")),
      output: optionalJson(get(r, "output")),
      startedAt: parseDate(get(r, "startedAt")),
      completedAt: parseOptionalDate(get(r, "completedAt")),
      error: parseOptionalString(get(r, "error")),
    })),
  });

  await prisma.workflowMessage.createMany({
    data: rowMap(workflowMessage).map((r) => ({
      id: parseString(get(r, "id")),
      runId: parseString(get(r, "runId")),
      fromStepId: parseOptionalString(get(r, "fromStepId")),
      toStepId: parseOptionalString(get(r, "toStepId")),
      fromAgentId: parseOptionalString(get(r, "fromAgentId")),
      toAgentId: parseOptionalString(get(r, "toAgentId")),
      channel: parseString(get(r, "channel")),
      content: parseString(get(r, "content")),
      createdAt: parseDate(get(r, "createdAt")),
    })),
  });

  await prisma.agentTrace.createMany({
    data: rowMap(agentTrace).map((r) => ({
      id: parseString(get(r, "id")),
      runId: parseString(get(r, "runId")),
      stepId: parseString(get(r, "stepId")),
      agentId: parseString(get(r, "agentId")),
      model: parseString(get(r, "model")),
      promptTokens: parseIntField(get(r, "promptTokens")),
      completionTokens: parseIntField(get(r, "completionTokens")),
      costUsd: parseDecimal(get(r, "costUsd")),
      latencyMs: parseIntField(get(r, "latencyMs")),
      createdAt: parseDate(get(r, "createdAt")),
    })),
  });

  await prisma.workflowRunEvent.createMany({
    data: rowMap(workflowRunEvent).map((r) => ({
      id: parseString(get(r, "id")),
      runId: parseString(get(r, "runId")),
      type: parseString(get(r, "type")),
      payload: parseJson(get(r, "payload")),
      at: parseDate(get(r, "at")),
      createdAt: parseDate(get(r, "createdAt")),
    })),
  });

  for (const r of rowMap(memory)) {
    const id = parseString(get(r, "id"));
    const namespace = parseString(get(r, "namespace"));
    const content = parseString(get(r, "content"));
    const embedding = parseString(get(r, "embedding"));
    const tags = parsePgArray(get(r, "tags"));
    const createdByAgentId = parseString(get(r, "createdByAgentId"));
    const createdAt = parseDate(get(r, "createdAt"));

    await prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "Memory" (
          id, namespace, content, embedding, tags, "createdByAgentId", "createdAt"
        ) VALUES (
          ${id}::uuid,
          ${namespace},
          ${content},
          ${embedding}::vector,
          ${tags}::text[],
          ${createdByAgentId},
          ${createdAt}::timestamptz
        )
      `,
    );
  }
}

export const TRUNCATE_SQL = `TRUNCATE TABLE
  "WorkflowRunEvent",
  "AgentTrace",
  "WorkflowMessage",
  "WorkflowStep",
  "WorkflowRun",
  "Workflow",
  "Memory",
  "Agent",
  "Skill"
CASCADE`;
