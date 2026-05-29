import { z } from "zod";
import { ToolDefinition } from "./types.js";

const inputSchema = z.object({
  content: z.string().min(1).describe("The information to store in memory."),
  tags: z
    .array(z.string())
    .optional()
    .describe("Optional tags for categorising this memory."),
});

export const memoryWriteTool = new ToolDefinition(
  "memory.write",
  "Persist a piece of information to agent memory so it can be recalled in future invocations.",
  inputSchema,
  async (input, ctx): Promise<string> => {
    if (!ctx.memoryService) {
      return "Error: memory is not enabled for this agent.";
    }

    try {
      const item = await ctx.memoryService.write(
        ctx.memoryNamespace,
        input.content,
        { tags: input.tags, agentId: ctx.agentId },
      );
      return `Memory written (id: ${item.id}).`;
    } catch (err) {
      return `Error: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
);
