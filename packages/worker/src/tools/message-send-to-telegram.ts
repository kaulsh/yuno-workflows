import { z } from "zod";
import { ToolDefinition } from "./types.js";

const inputSchema = z.object({
  text: z.string().min(1).describe("Message text to send to the Telegram chat."),
});

export const messageSendToTelegramTool = new ToolDefinition(
  "message.send_to_telegram",
  "Send a message to the Telegram chat that triggered this workflow run.",
  inputSchema,
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
