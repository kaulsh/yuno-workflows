import { DynamicStructuredTool } from "@langchain/core/tools";
import { logger } from "@workspace/shared";
import type { ToolContext } from "./types.js";
import { fsReadTool } from "./fs-read.js";
import { fsWriteTool } from "./fs-write.js";
import { bashExecTool } from "./bash-exec.js";
import { httpFetchTool } from "./http-fetch.js";
import { memoryRecallTool } from "./memory-recall.js";
import { memoryWriteTool } from "./memory-write.js";
import { messageSendToTelegramTool } from "./message-send-to-telegram.js";
import { webSearchTool } from "./web-search.js";
import { loadSkillTool } from "./load-skill.js";

const ALL_TOOLS = [
  fsReadTool,
  fsWriteTool,
  bashExecTool,
  httpFetchTool,
  memoryRecallTool,
  memoryWriteTool,
  messageSendToTelegramTool,
  webSearchTool,
  loadSkillTool,
];

/**
 * Static registry keyed by tool name.
 * Extending the platform: add a new file under src/tools/, import it here,
 * and add it to ALL_TOOLS. No DB table or runtime registration needed.
 */
export const TOOLS_REGISTRY = Object.fromEntries(
  ALL_TOOLS.map((t) => [t.name, t]),
);

/**
 * Resolves a set of tool names to LangChain DynamicStructuredTool instances
 * bound to the provided ToolContext.
 *
 * Called by the agent runtime once per agent invocation, after the ToolContext
 * is fully populated by the orchestrator.
 */
export function resolveTools(
  toolNames: string[],
  ctx: ToolContext,
): DynamicStructuredTool[] {
  return toolNames.flatMap((name) => {
    const def = TOOLS_REGISTRY[name];
    if (!def) {
      logger.warn({ toolName: name }, "[tools] unknown tool name — skipping");
      return [];
    }
    return [
      new DynamicStructuredTool({
        name: def.name,
        description: def.description,
        schema: def.inputSchema,
        func: async (input) => def.execute(input, ctx),
      }),
    ];
  });
}

export type { ToolDefinition, ToolContext } from "./types.js";
