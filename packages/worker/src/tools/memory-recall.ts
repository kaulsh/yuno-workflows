import { memoryRecallToolDef } from "@workspace/shared/tools";
import { ToolDefinition } from "./types.js";

export const memoryRecallTool = new ToolDefinition(
  memoryRecallToolDef.name,
  memoryRecallToolDef.description,
  memoryRecallToolDef.inputSchema,
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
