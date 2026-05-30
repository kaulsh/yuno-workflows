import { Telegraf, type Context } from "telegraf";
import { message } from "telegraf/filters";
import type { PrismaClient } from "@workspace/db-adapter";
import { logger, type TriggerContext } from "@workspace/shared";
import {
  WorkflowStartPublisher,
  type WorkflowStartMessage,
  type ConfirmChannel,
} from "@workspace/rmq";

let bot: Telegraf | null = null;

/**
 * Initialises the Telegraf bot in long-polling mode.
 *
 * After setup:
 *  - Reads all telegram-triggered workflows from DB at startup and registers
 *    them as slash commands via setMyCommands (for Telegram's UI autocomplete)
 *  - On every incoming command, re-queries the DB so newly added workflows are
 *    picked up without a server restart
 *  - Routes each command → workflow.start publish
 *  - Falls back to a help reply for unknown commands
 *
 */
export async function startTelegramBot(
  token: string,
  prisma: PrismaClient,
  publishChannel: ConfirmChannel,
): Promise<Telegraf> {
  bot = new Telegraf(token);

  type TriggerConfig = { source: string; command?: string; helpText?: string };

  async function resolveWorkflows() {
    const workflows = await prisma.workflow.findMany({
      where: { triggerType: "telegram_message" },
    });

    const commandMap = new Map<string, string>();
    const botCommands: Array<{ command: string; description: string }> = [];

    for (const wf of workflows) {
      const cfg = wf.triggerConfig as TriggerConfig;
      if (cfg.source === "telegram" && cfg.command) {
        const cmd = cfg.command.replace(/^\//, "");
        commandMap.set(cmd, wf.id);
        botCommands.push({
          command: cmd,
          description: cfg.helpText || wf.description || "Run workflow",
        });
      }
    }

    return { commandMap, botCommands };
  }

  const initial = await resolveWorkflows();
  if (initial.botCommands.length > 0) {
    await bot.telegram.setMyCommands(initial.botCommands);
    logger.info(
      { commands: initial.botCommands.map((c) => `/${c.command}`) },
      `[telegram] registered ${initial.botCommands.length} command(s)`,
    );
  }

  bot.on(message("text"), async (ctx: Context) => {
    const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";
    if (!text.startsWith("/")) return;

    const [rawCmd, ...rest] = text.split(" ");
    const cmd = rawCmd!.slice(1).split("@")[0]!;
    const restText = rest.join(" ").trim();

    const { commandMap, botCommands } = await resolveWorkflows();

    const workflowId = commandMap.get(cmd);
    if (!workflowId) {
      const helpLines = botCommands.map(
        (c) => `/${c.command} — ${c.description}`,
      );
      const helpText =
        helpLines.length > 0
          ? `Available commands:\n${helpLines.join("\n")}`
          : "No workflows are configured for Telegram yet.";
      await ctx.reply(helpText);
      return;
    }

    const chatId = ctx.chat?.id;
    const userId = ctx.from?.id;
    if (!chatId) return;

    const triggerContext: TriggerContext = {
      source: "telegram",
      chatId,
      userId: userId ?? 0,
    };

    const msg: WorkflowStartMessage = {
      workflowId,
      initialInput: restText || undefined,
      triggerContext,
    };

    await WorkflowStartPublisher(publishChannel).publish(msg, ["start"]);

    logger.info(
      { cmd, workflowId, chatId },
      `[telegram] /${cmd} → workflow ${workflowId}`,
    );

  });

  bot.launch({ dropPendingUpdates: true });
  logger.info("[telegram] bot started (long-polling)");

  return bot;
}

/**
 * Returns a send function bound to the running bot instance.
 * Used by the message.send_to_telegram tool.
 */
export function getSendTelegram():
  | ((chatId: string, text: string) => Promise<void>)
  | null {
  if (!bot) return null;
  return async (chatId: string, text: string) => {
    if (!text.trim()) {
      logger.warn({ chatId }, "[telegram] sendMessage skipped — empty text");
      return;
    }
    await bot!.telegram.sendMessage(chatId, text);
  };
}

export function stopTelegramBot(): void {
  bot?.stop("SIGTERM");
}
