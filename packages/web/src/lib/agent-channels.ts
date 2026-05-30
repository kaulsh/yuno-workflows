import type { Channel } from "@workspace/shared";

/** Implicit for workflow agents (agent-to-agent via edges) — not shown in the UI. */
export const INTERNAL_CHANNEL: Channel = "internal";

export function displayChannels(channels: Channel[]): Channel[] {
  return channels.filter((ch) => ch !== INTERNAL_CHANNEL);
}

/** Ensures internal is always persisted for workflow messaging. */
export function withInternalChannel(channels: Channel[]): Channel[] {
  const rest = channels.filter((ch) => ch !== INTERNAL_CHANNEL);
  return [INTERNAL_CHANNEL, ...rest];
}
