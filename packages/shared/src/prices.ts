/**
 * Cached tokens are not included in the price calculation.
 */

const centsPerMillion = (dollars: number) => dollars / 1e6;

export const MODELS = {
  "gpt-5.5-2026-04-23": {
    provider: "openai",
    in: centsPerMillion(5),
    out: centsPerMillion(30),
    optional: false,
  },
  "gpt-5.4-2026-03-05": {
    provider: "openai",
    in: centsPerMillion(2.5),
    out: centsPerMillion(15),
    optional: false,
  },
  "claude-opus-4-7": {
    provider: "anthropic",
    in: centsPerMillion(5),
    out: centsPerMillion(25),
    optional: true,
  },
  "claude-sonnet-4-6": {
    provider: "anthropic",
    in: centsPerMillion(3),
    out: centsPerMillion(15),
    optional: true,
  },
  "gemini-3.5-flash": {
    provider: "google",
    in: centsPerMillion(0.75),

    out: centsPerMillion(4.5),
    optional: true,
  },
} as const;

export type ModelId = keyof typeof MODELS;
export type ModelProvider = (typeof MODELS)[ModelId]["provider"];

export const MODEL_IDS = Object.keys(MODELS) as ModelId[];

export function computeCostUsd(
  model: ModelId,
  promptTokens: number,
  completionTokens: number,
): number {
  const pricing = MODELS[model];
  return promptTokens * pricing.in + completionTokens * pricing.out;
}
