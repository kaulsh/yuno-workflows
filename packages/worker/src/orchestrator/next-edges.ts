import type {
  WorkflowNode,
  WorkflowEdge,
  ConditionExpression,
} from "@workspace/shared";
import { evalConditionBranch } from "./eval-condition.js";

export interface NextEdgeResult {
  nextNodeId: string;
  /** The edge that was selected */
  edge: WorkflowEdge;
}

/**
 * Given the current node and its resolved outgoing edges, determines the next
 * node(s) to visit.
 *
 * - Agent nodes → exactly 1 outgoing edge, no branch evaluation needed.
 * - Condition nodes → evaluate the condition against predecessorOutput to pick
 *   the "true" or "false" branch.
 * - End nodes → no next nodes (returns []).
 *
 */
export function resolveNextEdges(
  node: WorkflowNode,
  allEdges: WorkflowEdge[],
  predecessorOutput:
    | { branch: "true" | "false"; predecessorOutput: Record<string, unknown> }
    | Record<string, unknown>,
): NextEdgeResult[] {
  const outgoing = allEdges.filter((e) => e.source === node.id);

  if (node.type === "end") return [];

  if (node.type === "agent") {
    if (outgoing.length !== 1) {
      throw new Error(
        `Agent node "${node.id}" must have exactly 1 outgoing edge, found ${outgoing.length}`,
      );
    }

    return [{ nextNodeId: outgoing[0]!.target, edge: outgoing[0]! }];
  }

  if (node.type === "condition") {
    if ("branch" in predecessorOutput) {
      const chosen = outgoing.find(
        (e) => e.branch === predecessorOutput.branch,
      );
      if (!chosen) {
        throw new Error(
          `Condition node "${node.id}" has no outgoing edge for branch "${predecessorOutput.branch}"`,
        );
      }
      return [{ nextNodeId: chosen.target, edge: chosen }];
    }

    const branch = evalConditionBranch(node.expression, predecessorOutput);

    const chosen = outgoing.find((e) => e.branch === branch);

    if (!chosen) {
      throw new Error(
        `Condition node "${node.id}" has no outgoing edge for branch "${branch}"`,
      );
    }

    return [{ nextNodeId: chosen.target, edge: chosen }];
  }

  // Should not reach here given validated graph, but guard anyway
  throw new Error(`Unknown node: ${JSON.stringify(node)}`);
}
