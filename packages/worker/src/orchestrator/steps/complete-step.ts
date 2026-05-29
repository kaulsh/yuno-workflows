import type { PrismaClient } from "@workspace/db-adapter";

export async function completeStep(
  prisma: PrismaClient,
  stepId: string,
  output: Record<string, unknown>,
): Promise<void> {
  await prisma.workflowStep.update({
    where: { id: stepId },
    data: {
      status: "completed",
      output: output as object,
      completedAt: new Date(),
    },
  });
}
