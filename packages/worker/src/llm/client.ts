import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { MODELS, type ModelId } from "@workspace/shared";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

interface ModelOptions {
  temperature?: number;
  maxTokens?: number;
}

/**
 * Provider-agnostic LLM factory. Returns the appropriate LangChain chat model
 * instance based on the model string in the MODELS price table.
 * Anthropic and Google providers are optional — their packages are only
 * imported if the corresponding env key is present.
 */
export async function getChatModel(
  model: ModelId,
  opts: ModelOptions = {},
): Promise<BaseChatModel> {
  const entry = MODELS[model];
  const { temperature = 0.7, maxTokens = 1024 } = opts;

  switch (entry.provider) {
    case "openai":
      return new ChatOpenAI({
        model,
        temperature,
        maxTokens,
        apiKey: process.env["OPENAI_API_KEY"],
      });

    case "anthropic": {
      return new ChatAnthropic({
        model,
        temperature,
        maxTokens,
        apiKey: process.env["ANTHROPIC_API_KEY"],
      });
    }

    case "google": {
      return new ChatGoogleGenerativeAI({
        model,
        temperature,
        maxOutputTokens: maxTokens,
        apiKey: process.env["GOOGLE_API_KEY"],
      });
    }

    default:
      throw new Error(`Unknown model provider for model "${model}"`);
  }
}
