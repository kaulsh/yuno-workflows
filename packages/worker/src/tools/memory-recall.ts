import { z } from "zod";
import { ToolDefinition } from "./types.js";

const inputSchema = z.object({
  query: z.string().min(1).describe("The query to search memory for."),
  k: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Number of memories to retrieve. Defaults to the agent's configured k."),
});

export const memoryRecallTool = new ToolDefinition(
  "memory.recall",
  "Search agent memory for relevant past information using semantic similarity or recency ordering.",
  inputSchema,
  async (input, ctx): Promise<string> => {
    if (!ctx.memoryService) {
      return "Error: memory is not enabled for this agent.";
    }

    try {
      const k = input.k ?? ctx.memoryK;
      const items = await ctx.memoryService.recall(
        ctx.memoryNamespace,
        input.query,
        k,
        ctx.memoryStrategy,
      );

      if (items.length === 0) {
        return "No relevant memories found.";
      }

      return items
        .map((item, i) => `[${i + 1}] ${item.content}`)
        .join("\n\n");
    } catch (err) {
      return `Error: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
);
