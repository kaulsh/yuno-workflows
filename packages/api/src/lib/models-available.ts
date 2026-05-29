import { listAllModels, MODELS, type AvailableModel } from "@workspace/shared";

const PROVIDER_ENV: Record<
  AvailableModel["provider"],
  string | undefined
> = {
  openai: process.env["OPENAI_API_KEY"],
  anthropic: process.env["ANTHROPIC_API_KEY"],
  google: process.env["GOOGLE_API_KEY"],
};

/* Get models from the shared library but only send those that would be enabled via env keys */
export function listAvailableModels(): AvailableModel[] {
  return listAllModels().filter((m) => {
    if (!MODELS[m.id].optional) return true;
    return Boolean(PROVIDER_ENV[m.provider]);
  });
}
