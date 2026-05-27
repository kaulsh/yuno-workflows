import { z } from "zod";

import { MODEL_IDS, MODELS } from "../prices.js";

export const ModelProviderSchema = z.enum(["openai", "anthropic", "google"]);

export const AvailableModelSchema = z.object({
  id: z.enum(MODEL_IDS),
  provider: ModelProviderSchema,
  optional: z.boolean(),
});

export const AvailableModelsResponseSchema = z.object({
  models: z.array(AvailableModelSchema),
});

export type AvailableModel = z.infer<typeof AvailableModelSchema>;
export type AvailableModelsResponse = z.infer<
  typeof AvailableModelsResponseSchema
>;

/** Build the catalog row shape from the static price table. */
export function listAllModels(): AvailableModel[] {
  return MODEL_IDS.map((id) => ({
    id,
    provider: MODELS[id].provider,
    optional: MODELS[id].optional,
  }));
}
