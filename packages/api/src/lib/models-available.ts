import { listAllModels, type AvailableModel } from "@workspace/shared";

const PROVIDER_ENV: Record<
  AvailableModel["provider"],
  string | undefined
> = {
  openai: process.env["OPENAI_API_KEY"],
  anthropic: process.env["ANTHROPIC_API_KEY"],
  google: process.env["GOOGLE_API_KEY"],
};

/** Only models whose provider API key is configured (optional providers stay hidden otherwise). */
export function listAvailableModels(): AvailableModel[] {
  return listAllModels().filter((m) => Boolean(PROVIDER_ENV[m.provider]));
}
