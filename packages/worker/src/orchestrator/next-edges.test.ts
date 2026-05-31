import type {
  ConditionExpression,
  WorkflowEdge,
  WorkflowNode,
} from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { evalConditionBranch } from "./eval-condition.js";
import { resolveNextEdges } from "./next-edges.js";

const pos = { x: 0, y: 0 };
const agentId = "00000000-0000-4000-8000-000000000001";

function agentNode(id: string): WorkflowNode {
  return {
    id,
    type: "agent",
    agentId,
    task: "task",
    position: pos,
  };
}

function conditionNode(
  id: string,
  expression: ConditionExpression,
): WorkflowNode {
  return { id, type: "condition", expression, position: pos };
}

function endNode(id: string): WorkflowNode {
  return { id, type: "end", position: pos };
}

function edge(
  id: string,
  source: string,
  target: string,
  branch?: "true" | "false",
): WorkflowEdge {
  return { id, source, target, ...(branch ? { branch } : {}) };
}

/** Mirrors orchestrator step counting from run-step.ts (pure, no DB). */
function wouldExceedMaxSteps(stepCount: number, maxSteps: number): boolean {
  return stepCount + 1 > maxSteps;
}

function conditionStepOutput(
  node: Extract<WorkflowNode, { type: "condition" }>,
  predecessorOutput: Record<string, unknown>,
): { branch: "true" | "false"; predecessorOutput: Record<string, unknown> } {
  const branch = evalConditionBranch(node.expression, predecessorOutput);
  return { branch, predecessorOutput };
}

/**
 * Walks a workflow using resolveNextEdges until end or maxSteps.
 * `outputs[nodeId]` is the raw predecessor output before a condition step runs.
 */
function walkGraph(params: {
  startNodeId: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  outputs: Record<string, Record<string, unknown>>;
  maxSteps: number;
  /** Called immediately before each condition step (e.g. to bump loop counters). */
  onConditionStep?: () => void;
}): { path: string[]; halted: "completed" | "max_steps" } {
  const { nodes, edges, outputs, maxSteps, onConditionStep } = params;
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const path: string[] = [];
  let currentId = params.startNodeId;
  let stepCount = 0;

  while (true) {
    const node = nodeById.get(currentId);
    if (!node) throw new Error(`unknown node ${currentId}`);

    path.push(currentId);

    if (node.type === "end") {
      return { path, halted: "completed" };
    }

    if (wouldExceedMaxSteps(stepCount, maxSteps)) {
      return { path, halted: "max_steps" };
    }
    stepCount += 1;

    if (node.type === "condition") {
      onConditionStep?.();
    }

    const stepOutput =
      node.type === "condition"
        ? conditionStepOutput(node, outputs[node.id] ?? {})
        : (outputs[node.id] ?? {});

    const next = resolveNextEdges(node, edges, stepOutput);
    currentId = next[0]!.nextNodeId;
  }
}

describe("resolveNextEdges", () => {
  const loopEdges = [
    edge("e1", "a1", "cond"),
    edge("e2", "cond", "a2", "false"),
    edge("e3", "cond", "end", "true"),
    edge("e4", "a2", "cond"),
  ];

  it("returns no edges from an end node", () => {
    expect(resolveNextEdges(endNode("end"), loopEdges, {})).toEqual([]);
  });

  it("follows the single outgoing edge from an agent node", () => {
    const agentEdges = [edge("e1", "a1", "cond")];
    const [next] = resolveNextEdges(agentNode("a1"), agentEdges, { ok: true });
    expect(next).toEqual({
      nextNodeId: "cond",
      edge: agentEdges[0],
    });
  });

  it("throws when an agent node does not have exactly one outgoing edge", () => {
    expect(() =>
      resolveNextEdges(agentNode("a2"), [edge("x", "a2", "end")], {}),
    ).not.toThrow();
    expect(() => resolveNextEdges(agentNode("a2"), [], {})).toThrow(
      /exactly 1 outgoing edge/,
    );
    expect(() =>
      resolveNextEdges(agentNode("a2"), [
        edge("x1", "a2", "end"),
        edge("x2", "a2", "cond"),
      ], {}),
    ).toThrow(/exactly 1 outgoing edge/);
  });

  it("routes condition nodes by evaluating the expression", () => {
    const cond = conditionNode("cond", {
      field: "hire",
      op: "equals",
      value: true,
    });

    const trueBranch = resolveNextEdges(cond, loopEdges, { hire: true });
    expect(trueBranch[0]!.nextNodeId).toBe("end");

    const falseBranch = resolveNextEdges(cond, loopEdges, { hire: false });
    expect(falseBranch[0]!.nextNodeId).toBe("a2");
  });

  it("routes condition nodes using a precomputed branch from the condition step", () => {
    const cond = conditionNode("cond", {
      field: "hire",
      op: "equals",
      value: true,
    });

    const routed = resolveNextEdges(cond, loopEdges, {
      branch: "false",
      predecessorOutput: { hire: true },
    });
    expect(routed[0]!.nextNodeId).toBe("a2");
  });

  it("throws when the chosen branch has no matching edge", () => {
    const cond = conditionNode("cond", {
      field: "hire",
      op: "equals",
      value: true,
    });
    const dangling = [edge("only-false", "cond", "a2", "false")];

    expect(() =>
      resolveNextEdges(cond, dangling, { hire: true }),
    ).toThrow(/no outgoing edge for branch "true"/);
  });
});

describe("cyclic graph traversal", () => {
  // a1 -> cond -> (true -> end) | (false -> a2 -> cond)
  const nodes = [
    agentNode("a1"),
    agentNode("a2"),
    conditionNode("cond", {
      field: "retry",
      op: "equals",
      value: 3,
    }),
    endNode("end"),
  ];

  const edges = [
    edge("e1", "a1", "cond"),
    edge("e2", "cond", "a2", "false"),
    edge("e3", "cond", "end", "true"),
    edge("e4", "a2", "cond"),
  ];

  it("loops through a2 until the condition takes the true branch", () => {
    const outputs: Record<string, Record<string, unknown>> = {
      a1: {},
      a2: {},
      cond: { retry: 0 },
    };
    let visits = 0;

    const result = walkGraph({
      startNodeId: "a1",
      nodes,
      edges,
      outputs,
      maxSteps: 25,
      onConditionStep: () => {
        visits += 1;
        outputs.cond = { retry: visits };
      },
    });

    expect(result.halted).toBe("completed");
    expect(result.path).toEqual(["a1", "cond", "a2", "cond", "a2", "cond", "end"]);
    expect(visits).toBe(3);
  });

  it("halts when maxSteps would be exceeded on a feedback loop", () => {
    const result = walkGraph({
      startNodeId: "a1",
      nodes,
      edges,
      outputs: {
        a1: {},
        a2: {},
        cond: { retry: 1 },
      },
      maxSteps: 4,
    });

    expect(result.halted).toBe("max_steps");
    expect(result.path).toEqual(["a1", "cond", "a2", "cond", "a2"]);
  });

  it("completes when maxSteps allows the loop to finish", () => {
    const result = walkGraph({
      startNodeId: "a1",
      nodes,
      edges,
      outputs: {
        a1: {},
        a2: {},
        cond: { retry: 3 },
      },
      maxSteps: 10,
    });

    expect(result.halted).toBe("completed");
    expect(result.path).toEqual(["a1", "cond", "end"]);
  });
});
