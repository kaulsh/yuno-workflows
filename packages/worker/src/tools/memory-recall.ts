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

      const MAX_ITEM_CHARS = 2_000;
      const MAX_TOTAL_CHARS = 10_000;

      const formatted = items.map((item, i) => {
        const content =
          item.content.length > MAX_ITEM_CHARS
            ? item.content.slice(0, MAX_ITEM_CHARS) + " [truncated]"
            : item.content;
        return `[${i + 1}] ${content}`;
      });

      const joined = formatted.join("\n\n");
      if (joined.length > MAX_TOTAL_CHARS) {
        return joined.slice(0, MAX_TOTAL_CHARS) + "\n\n[further memories truncated — total limit reached]";
      }
      return joined;
    } catch (err) {
      return `Error: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
);
