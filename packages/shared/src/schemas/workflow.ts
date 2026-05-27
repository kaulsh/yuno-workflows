import { z } from "zod";

import { JsonSchemaSchema, IsoDateTimeSchema, UuidSchema } from "./common.js";

export const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const ConditionOpSchema = z.enum([
  "equals",
  "not_equals",
  "contains",
  "gt",
  "gte",
  "lt",
  "lte",
  "between",
  "is_truthy",
  "matches",
]);

export const ConditionValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.tuple([z.number(), z.number()]),
]);

export const ConditionExpressionSchema = z.object({
  field: z.string().min(1),
  op: ConditionOpSchema,
  value: ConditionValueSchema,
});

export const WorkflowNodeSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().min(1),
    type: z.literal("agent"),
    agentId: UuidSchema,
    task: z.string(),
    outputSchema: JsonSchemaSchema.optional(),
    position: PositionSchema,
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("condition"),
    expression: ConditionExpressionSchema,
    position: PositionSchema,
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("end"),
    position: PositionSchema,
  }),
]);

export const WorkflowEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  branch: z.enum(["true", "false"]).optional(),
});

export const TriggerTypeSchema = z.enum([
  "manual",
  "telegram_message",
  "schedule",
]);

export const TriggerConfigSchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("manual") }),
  z.object({
    source: z.literal("telegram"),
    command: z.string().min(1),
    helpText: z.string(),
  }),
  z.object({
    source: z.literal("schedule"),
    cron: z.string().min(1),
  }),
]);

export const WorkflowGraphSchema = z.object({
  nodes: z.array(WorkflowNodeSchema).min(1),
  edges: z.array(WorkflowEdgeSchema),
  entryNodeId: z.string().min(1),
  maxSteps: z.number().int().positive().default(25),
});

export const WorkflowSchema = z
  .object({
    id: UuidSchema,
    name: z.string().min(1),
    description: z.string(),
    triggerType: TriggerTypeSchema,
    triggerConfig: TriggerConfigSchema,
    nodes: z.array(WorkflowNodeSchema),
    edges: z.array(WorkflowEdgeSchema),
    entryNodeId: z.string().min(1),
    maxSteps: z.number().int().positive().default(25),
    isTemplate: z.boolean().default(false),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .superRefine((workflow, ctx) => {
    validateTriggerAlignment(workflow.triggerType, workflow.triggerConfig, ctx);
    validateWorkflowGraph(
      {
        nodes: workflow.nodes,
        edges: workflow.edges,
        entryNodeId: workflow.entryNodeId,
        maxSteps: workflow.maxSteps,
      },
      ctx,
    );
  });

export const CreateWorkflowInputSchema = z
  .object({
    name: z.string().min(1),
    description: z.string(),
    triggerType: TriggerTypeSchema,
    triggerConfig: TriggerConfigSchema,
    nodes: z.array(WorkflowNodeSchema).min(1),
    edges: z.array(WorkflowEdgeSchema),
    entryNodeId: z.string().min(1),
    maxSteps: z.number().int().positive().default(25),
    isTemplate: z.boolean().default(false).optional(),
  })
  .superRefine((workflow, ctx) => {
    validateTriggerAlignment(workflow.triggerType, workflow.triggerConfig, ctx);
    validateWorkflowGraph(workflow, ctx);
  });

export const UpdateWorkflowInputSchema = CreateWorkflowInputSchema;

export const CloneWorkflowInputSchema = z.object({
  name: z.string().min(1),
});

export const RunWorkflowInputSchema = z.object({
  initialInput: z.string().optional(),
});

export type Workflow = z.infer<typeof WorkflowSchema>;
export type WorkflowNode = z.infer<typeof WorkflowNodeSchema>;
export type WorkflowEdge = z.infer<typeof WorkflowEdgeSchema>;
export type ConditionExpression = z.infer<typeof ConditionExpressionSchema>;
export type ConditionOp = z.infer<typeof ConditionOpSchema>;
export type TriggerType = z.infer<typeof TriggerTypeSchema>;
export type TriggerConfig = z.infer<typeof TriggerConfigSchema>;
export type WorkflowGraph = z.infer<typeof WorkflowGraphSchema>;
export type CreateWorkflowInput = z.infer<typeof CreateWorkflowInputSchema>;
export type UpdateWorkflowInput = z.infer<typeof UpdateWorkflowInputSchema>;
export type CloneWorkflowInput = z.infer<typeof CloneWorkflowInputSchema>;
export type RunWorkflowInput = z.infer<typeof RunWorkflowInputSchema>;

function validateTriggerAlignment(
  triggerType: TriggerType,
  triggerConfig: TriggerConfig,
  ctx: z.RefinementCtx,
): void {
  const expected: Record<TriggerType, TriggerConfig["source"]> = {
    manual: "manual",
    telegram_message: "telegram",
    schedule: "schedule",
  };
  if (triggerConfig.source !== expected[triggerType]) {
    ctx.addIssue({
      code: "custom",
      message: `triggerConfig.source must be "${expected[triggerType]}" when triggerType is "${triggerType}"`,
      path: ["triggerConfig", "source"],
    });
  }
}

/** §11 edge-cardinality and graph integrity rules (also used by workflow builder). */
export function validateWorkflowGraph(
  graph: WorkflowGraph,
  ctx: z.RefinementCtx,
): void {
  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  const nodesById = new Map(graph.nodes.map((n) => [n.id, n]));

  if (!nodeIds.has(graph.entryNodeId)) {
    ctx.addIssue({
      code: "custom",
      message: "entryNodeId must reference an existing node",
      path: ["entryNodeId"],
    });
  }

  const incoming = new Map<string, number>();
  for (const node of graph.nodes) {
    incoming.set(node.id, 0);
  }

  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.source)) {
      ctx.addIssue({
        code: "custom",
        message: `edge ${edge.id} references unknown source node ${edge.source}`,
        path: ["edges"],
      });
      continue;
    }
    if (!nodeIds.has(edge.target)) {
      ctx.addIssue({
        code: "custom",
        message: `edge ${edge.id} references unknown target node ${edge.target}`,
        path: ["edges"],
      });
      continue;
    }
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);

    const sourceNode = nodesById.get(edge.source);
    if (!sourceNode) continue;

    if (sourceNode.type === "agent") {
      if (edge.branch !== undefined) {
        ctx.addIssue({
          code: "custom",
          message: `edge ${edge.id}: agent nodes must not use branch`,
          path: ["edges"],
        });
      }
    } else if (sourceNode.type === "condition") {
      if (edge.branch !== "true" && edge.branch !== "false") {
        ctx.addIssue({
          code: "custom",
          message: `edge ${edge.id}: condition edges require branch "true" or "false"`,
          path: ["edges"],
        });
      }
    } else if (sourceNode.type === "end") {
      ctx.addIssue({
        code: "custom",
        message: `edge ${edge.id}: end nodes must not have outgoing edges`,
        path: ["edges"],
      });
    }
  }

  if ((incoming.get(graph.entryNodeId) ?? 0) > 0) {
    ctx.addIssue({
      code: "custom",
      message: "entry node must have no incoming edges",
      path: ["entryNodeId"],
    });
  }

  for (const node of graph.nodes) {
    const outgoing = graph.edges.filter((e) => e.source === node.id);

    if (node.type === "agent") {
      if (outgoing.length !== 1) {
        ctx.addIssue({
          code: "custom",
          message: `agent node ${node.id} must have exactly 1 outgoing edge`,
          path: ["nodes"],
        });
      }
    } else if (node.type === "condition") {
      const branches = new Set(outgoing.map((e) => e.branch));
      if (
        outgoing.length !== 2 ||
        !branches.has("true") ||
        !branches.has("false")
      ) {
        ctx.addIssue({
          code: "custom",
          message: `condition node ${node.id} must have exactly 2 outgoing edges with branches "true" and "false"`,
          path: ["nodes"],
        });
      }
    } else if (node.type === "end") {
      if (outgoing.length !== 0) {
        ctx.addIssue({
          code: "custom",
          message: `end node ${node.id} must have 0 outgoing edges`,
          path: ["nodes"],
        });
      }
      if ((incoming.get(node.id) ?? 0) < 1) {
        ctx.addIssue({
          code: "custom",
          message: `end node ${node.id} must have at least 1 incoming edge`,
          path: ["nodes"],
        });
      }
    }
  }
}
