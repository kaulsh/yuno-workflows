import type { PrismaClient } from "@workspace/db-adapter";
import { WorkflowNodeSchema } from "@workspace/shared";
import { badRequest } from "./errors.js";

/** Ensures every agent node references an existing agent (DESIGN §11). */
export async function assertWorkflowAgentIdsExist(
  prisma: PrismaClient,
  nodes: unknown,
): Promise<void> {
  const parsed = WorkflowNodeSchema.array().safeParse(nodes);
  if (!parsed.success) return;

  const agentIds = [
    ...new Set(
      parsed.data.filter((n) => n.type === "agent").map((n) => n.agentId),
    ),
  ];
  if (agentIds.length === 0) return;

  const found = await prisma.agent.findMany({
    where: { id: { in: agentIds } },
    select: { id: true },
  });
  const foundSet = new Set(found.map((a) => a.id));
  const missing = agentIds.filter((id) => !foundSet.has(id));
  if (missing.length > 0) {
    badRequest(`Unknown agent id(s): ${missing.join(", ")}`);
  }
}
