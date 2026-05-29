import { messageSendToTelegramToolDef } from "@workspace/shared/tools";
import { ToolDefinition } from "./types.js";

export const messageSendToTelegramTool = new ToolDefinition(
  messageSendToTelegramToolDef.name,
  messageSendToTelegramToolDef.description,
  messageSendToTelegramToolDef.inputSchema,
  async (input, ctx): Promise<string> => {
    if (!ctx.sendTelegram || !ctx.triggerChatId) {
      return "Error: Telegram is not available for this run (no trigger chatId or bot not configured).";
    }

    try {
      await ctx.sendTelegram(ctx.triggerChatId, input.text);
      return `Message sent to Telegram chat ${ctx.triggerChatId}.`;
    } catch (err) {
      return `Error: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
);
