import { memoryWriteToolDef } from "@workspace/shared/tools";
import { ToolDefinition } from "./types.js";

export const memoryWriteTool = new ToolDefinition(
  memoryWriteToolDef.name,
  memoryWriteToolDef.description,
  memoryWriteToolDef.inputSchema,
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
