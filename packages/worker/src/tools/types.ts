import { z } from "zod";
import type { MemoryService } from "../memory/index.js";

/**
 * Runtime context injected into every tool execute call.
 * The orchestrator populates these from the current step's run/agent state.
 */
export interface ToolContext {
  runId: string;
  stepId: string;
  agentId: string;

  // Memory
  memoryService: MemoryService | null;
  memoryNamespace: string;
  memoryStrategy: "semantic" | "recency";
  memoryK: number;

  // Telegram outbound (null when agent.channels doesn't include 'telegram')
  triggerChatId: string | null;
  sendTelegram: ((chatId: string, text: string) => Promise<void>) | null;

  /** Set when exactly one skill is attached; powers the runtime-only `load_skill` tool. */
  loadableSkill: {
    name: string;
    description: string;
    instructions: string;
  } | null;
}

export class ToolDefinition<TInput extends z.ZodType = z.ZodType> {
  constructor(
    public readonly name: string,
    public readonly description: string,
    public readonly inputSchema: TInput,
    public readonly execute: (
      input: z.infer<TInput>,
      ctx: ToolContext,
    ) => Promise<string>,
  ) {}
}
