import { createAgent } from "langchain";
import { HumanMessage } from "@langchain/core/messages";
import type { PrismaClient, Skill } from "@workspace/db-adapter";
import type { Agent, GuardrailsConfig } from "@workspace/shared";
import {
  applyInputGuardrails,
  applyOutputGuardrails,
} from "../guardrails/index.js";
import { getChatModel } from "../llm/client.js";
import {
  TraceCallbackHandler,
  type TraceAccumulator,
} from "./trace-callback.js";
import { resolveTools } from "../tools/index.js";
import type { RunContext } from "./run-context.js";
import type { MemoryService } from "../memory/index.js";
import type { ToolContext } from "../tools/types.js";

export interface AgentNode {
  task: string;
  /** JSON Schema (from DB) for structured output. Absent → plain text. */
  outputSchema?: Record<string, unknown>;
}

export interface InvokeAgentResult {
  output: Record<string, unknown>;
  blocked: boolean;
  traces: TraceAccumulator;
}

interface InvokeAgentDeps {
  prisma: PrismaClient;
  memoryService: MemoryService;
  insertTrace: TraceCallbackHandler["deps"]["insertTrace"];
  publishEvent: TraceCallbackHandler["deps"]["publishEvent"];
  /** Optional: fn to send Telegram messages (provided when agent has telegram channel) */
  sendTelegram: ((chatId: string, text: string) => Promise<void>) | null;
}

/** Appends skill instructions and memory context to the base system prompt. */
function buildSystemPrompt(
  agent: Agent,
  skills: Skill[],
  memoryContext: Array<{ content: string }>,
  task: string,
): string {
  return [
    agent.systemPrompt,
    `## Role\n${agent.role}`,
    skills.length === 1
      ? `## Skills\nYou have one skill available ("${skills[0].name}"). Call the \`load_skill\` tool to load its instructions before applying skill-specific guidance.`
      : skills.length > 1
        ? [
            "## Skills",
            ...skills.map(
              (s) =>
                `- **${s.name}**\n  ${s.instructions.replace(/\n/g, "\n  ")}`
            ),
          ].join("\n\n")
   
        : "",
    memoryContext.length
      ? `## Relevant memory\n${memoryContext
          .map((m) => {
            const MAX_ITEM = 2_000;
            const content =
              m.content.length > MAX_ITEM
                ? m.content.slice(0, MAX_ITEM) + " [truncated]"
                : m.content;
            return `- ${content}`;
          })
          .join("\n")}`
      : "",
    `## Current task\n${task}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function unique(arr: string[]): string[] {
  return [...new Set(arr)];
}

/**
 * Loads skills referenced by the agent from the DB.
 */
async function loadSkills(
  prisma: PrismaClient,
  skillIds: string[],
): Promise<Skill[]> {
  if (skillIds.length === 0) return [];
  return prisma.skill.findMany({ where: { id: { in: skillIds } } });
}

/**
 * Core agent invocation wrapper.
 *
 * Sequence:
 *  1. Input guardrails (pre-LLM)
 *  2. Passive memory recall
 *  3. Build system prompt (base + role + skills + memory + task)
 *  4. Resolve tools (registry names + skill required tools + built-ins)
 *  5. Build LangGraph ReAct agent
 *  6. Invoke (intra-agent recursionLimit = 10)
 *  7. Extract output (structuredResponse or last message text)
 *  8. Output guardrails (PII + output denylist)
 */
export async function invokeAgent(
  agent: Agent,
  node: AgentNode,
  inboundMessage: string,
  ctx: RunContext,
  deps: InvokeAgentDeps,
): Promise<InvokeAgentResult> {
  const guardrails = agent.guardrails as GuardrailsConfig;
  const inputCheck = applyInputGuardrails(inboundMessage, guardrails);
  if (inputCheck.blocked) {
    return {
      output: { text: inputCheck.refusal },
      blocked: true,
      traces: { promptTokens: 0, completionTokens: 0, costUsd: 0 },
    };
  }

  const memCfg = agent.memory;
  const memoryContext = memCfg.enabled
    ? await deps.memoryService.recall(
        ctx.memoryNamespace,
        inboundMessage,
        memCfg.k,
        memCfg.strategy,
      )
    : [];

  const skills = await loadSkills(deps.prisma, agent.skillIds);
  const systemPrompt = buildSystemPrompt(
    agent,
    skills,
    memoryContext,
    node.task,
  );

  const toolNames = unique([
    ...agent.tools,
    ...skills.flatMap((s) => s.requiredTools),
  ]);
  const telegramEnabled = agent.channels.includes("telegram");
  const triggerChatId =
    telegramEnabled && ctx.triggerContext.source === "telegram"
      ? String(ctx.triggerContext.chatId)
      : null;

  const singleSkill = skills.length === 1 ? skills[0] : null;

  const toolCtx: ToolContext = {
    runId: ctx.runId,
    stepId: ctx.stepId,
    agentId: ctx.agentId,
    memoryService: memCfg.enabled ? deps.memoryService : null,
    memoryNamespace: ctx.memoryNamespace,
    memoryStrategy: memCfg.strategy,
    memoryK: memCfg.k,
    triggerChatId,
    sendTelegram: telegramEnabled ? deps.sendTelegram : null,
    loadableSkill: singleSkill
      ? {
          name: singleSkill.name,
          description: singleSkill.description,
          instructions: singleSkill.instructions,
        }
      : null,
  };

  // Runtime-only tools: memory, telegram, load_skill (single skill)
  const extraToolNames: string[] = [];
  if (memCfg.enabled) extraToolNames.push("memory_recall", "memory_write");
  if (telegramEnabled) extraToolNames.push("message_send_to_telegram");
  if (singleSkill) extraToolNames.push("load_skill");

  const tools = resolveTools(
    unique([...toolNames, ...extraToolNames]),
    toolCtx,
  );

  const llm = await getChatModel(ctx.model, {
    temperature: Number(agent.temperature),
    maxTokens: agent.maxOutputTokens,
  });

  const traceHandler = new TraceCallbackHandler(ctx, {
    insertTrace: deps.insertTrace,
    publishEvent: deps.publishEvent,
  });

  const lcAgent = createAgent({
    model: llm,
    tools,
    systemPrompt,
    ...(node.outputSchema
      ? {
          responseFormat: node.outputSchema as Record<string, unknown> & {
            type: string;
          },
        }
      : {}),
  });

  const humanContent = inboundMessage.trim() || node.task;

  const result = await lcAgent.invoke(
    { messages: [new HumanMessage(humanContent)] },
    {
      callbacks: [traceHandler],
    },
  );

  let output: Record<string, unknown>;
  if (node.outputSchema && "structuredResponse" in result) {
    output = result.structuredResponse as Record<string, unknown>;
  } else {
    // Last AI message text
    const messages: unknown[] = result.messages ?? [];
    const lastMsg = messages[messages.length - 1];
    const text =
      lastMsg && typeof lastMsg === "object" && "content" in lastMsg
        ? String((lastMsg as { content: unknown }).content)
        : "";
    output = { text };
  }

  const guarded = applyOutputGuardrails(output, guardrails);

  return { output: guarded, blocked: false, traces: traceHandler.totals() };
}
