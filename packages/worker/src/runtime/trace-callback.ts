import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import type { LLMResult } from "@langchain/core/outputs";
import type { Serialized } from "@langchain/core/load/serializable";
import {
  computeCostUsd,
  logger,
  type RunEvent,
} from "@workspace/shared";
import { normalizeTokenUsage } from "../llm/normalize-tokens.js";
import type { RunContext } from "./run-context.js";

export interface TraceAccumulator {
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
}

/**
 * LangChain callback handler that:
 *  - Writes one AgentTrace DB row per LLM call (a ReAct loop fires this N+1 times)
 *  - Publishes tool.called / tool.result SSE events
 *  - Accumulates token + cost totals for the step-level summary
 *
 */
export class TraceCallbackHandler extends BaseCallbackHandler {
  name = "trace-callback";

  private accumulator: TraceAccumulator = {
    promptTokens: 0,
    completionTokens: 0,
    costUsd: 0,
  };
  private llmStartMs = 0;

  constructor(
    private readonly ctx: RunContext,
    private readonly deps: {
      insertTrace: (data: {
        runId: string;
        stepId: string;
        agentId: string;
        model: string;
        promptTokens: number;
        completionTokens: number;
        costUsd: number;
        latencyMs: number;
      }) => Promise<void>;
      publishEvent: (event: RunEvent) => Promise<void>;
    },
  ) {
    super();
  }

  handleLLMStart(_llm: Serialized, _prompts: string[]): void {
    this.llmStartMs = Date.now();
  }

  async handleLLMEnd(out: LLMResult): Promise<void> {
    const latencyMs = Date.now() - this.llmStartMs;
    const usage = normalizeTokenUsage(out, this.ctx.model);
    const costUsd = computeCostUsd(
      this.ctx.model,
      usage.promptTokens,
      usage.completionTokens,
    );

    this.accumulator.promptTokens += usage.promptTokens;
    this.accumulator.completionTokens += usage.completionTokens;
    this.accumulator.costUsd += costUsd;

    try {
      await this.deps.insertTrace({
        runId: this.ctx.runId,
        stepId: this.ctx.stepId,
        agentId: this.ctx.agentId,
        model: this.ctx.model,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        costUsd,
        latencyMs,
      });
    } catch (err) {
      logger.error({ err }, "[trace] failed to insert agent trace");
    }
  }

  async handleToolStart(tool: Serialized, input: string): Promise<void> {
    const toolName =
      typeof tool === "object" && "name" in tool
        ? String(tool.name)
        : "unknown";
    try {
      await this.deps.publishEvent({
        type: "tool.called",
        runId: this.ctx.runId,
        at: new Date().toISOString(),
        stepId: this.ctx.stepId,
        toolName,
        input,
      });
    } catch (err) {
      logger.error({ err }, "[trace] failed to publish tool.called");
    }
  }

  async handleToolEnd(
    output: string,
    _runId: string,
    _parentRunId?: string,
    tags?: string[],
  ): Promise<void> {
    const toolName =
      tags?.find((t) => t.startsWith("tool:"))?.slice(5) ?? "unknown";
    try {
      await this.deps.publishEvent({
        type: "tool.result",
        runId: this.ctx.runId,
        at: new Date().toISOString(),
        stepId: this.ctx.stepId,
        toolName,
        output,
      });
    } catch (err) {
      logger.error({ err }, "[trace] failed to publish tool.result");
    }
  }

  /** Returns accumulated token + cost totals for the enclosing step. */
  totals(): TraceAccumulator {
    return { ...this.accumulator };
  }
}
