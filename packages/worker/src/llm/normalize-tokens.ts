import type { LLMResult } from "@langchain/core/outputs";
import type { ModelId } from "@workspace/shared";

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
}

/**
 * Normalizes token usage from different provider LLM result shapes.
 * OpenAI, Anthropic, and Google report usage differently inside LLMResult.
 */
export function normalizeTokenUsage(
  out: LLMResult,
  _model: ModelId,
): TokenUsage {
  // LLMResult.llmOutput varies by provider
  const llmOutput = out.llmOutput as Record<string, unknown> | undefined;

  if (!llmOutput) {
    // Try to extract from generation metadata
    const gen = out.generations?.[0]?.[0];
    const meta = (gen as { generationInfo?: Record<string, unknown> })
      ?.generationInfo;
    if (meta) {
      return extractFromMeta(meta);
    }
    return { promptTokens: 0, completionTokens: 0 };
  }

  // OpenAI: { tokenUsage: { promptTokens, completionTokens } }
  if ("tokenUsage" in llmOutput) {
    const tu = llmOutput["tokenUsage"] as Record<string, number>;
    return {
      promptTokens: tu["promptTokens"] ?? tu["prompt_tokens"] ?? 0,
      completionTokens: tu["completionTokens"] ?? tu["completion_tokens"] ?? 0,
    };
  }

  // Anthropic: { usage: { input_tokens, output_tokens } }
  if ("usage" in llmOutput) {
    const u = llmOutput["usage"] as Record<string, number>;
    return {
      promptTokens: u["input_tokens"] ?? u["promptTokens"] ?? 0,
      completionTokens: u["output_tokens"] ?? u["completionTokens"] ?? 0,
    };
  }

  // Google Gemini: { usageMetadata: { promptTokenCount, candidatesTokenCount } }
  if ("usageMetadata" in llmOutput) {
    const um = llmOutput["usageMetadata"] as Record<string, number>;
    return {
      promptTokens: um["promptTokenCount"] ?? 0,
      completionTokens: um["candidatesTokenCount"] ?? 0,
    };
  }

  return extractFromMeta(llmOutput);
}

function extractFromMeta(meta: Record<string, unknown>): TokenUsage {
  const promptTokens =
    (meta["prompt_tokens"] as number) ??
    (meta["promptTokens"] as number) ??
    (meta["input_tokens"] as number) ??
    0;
  const completionTokens =
    (meta["completion_tokens"] as number) ??
    (meta["completionTokens"] as number) ??
    (meta["output_tokens"] as number) ??
    0;
  return { promptTokens, completionTokens };
}
