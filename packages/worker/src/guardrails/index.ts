import type { GuardrailsConfig } from "@workspace/shared";

// these are naive patterns for demo purposes. Replace with Presidio or Azure Foundry PII detection models.
const PII_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  {
    label: "email",
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  },
  { label: "phone", pattern: /\+?[1-9]\d{6,14}\b/g },
  { label: "pan", pattern: /\b[A-Z]{5}\d{4}[A-Z]\b/g },
  { label: "us_ssn", pattern: /\b\d{3}-\d{2}-\d{4}\b/g },
];

const CANNED_REFUSAL =
  "I'm sorry, but I can't process that request due to content policy restrictions.";

export interface GuardrailResult {
  blocked: boolean;
  refusal?: string;
  output?: string;
}

/**
 * Parses a denylist entry: "/pattern/flags" → RegExp, else substring.
 * Returns a function that tests whether a string matches.
 */
function makeMatcher(entry: string): (text: string) => boolean {
  const reMatch = entry.match(/^\/(.+)\/([gimsuy]*)$/);
  if (reMatch) {
    const re = new RegExp(reMatch[1]!, reMatch[2]);
    return (text) => re.test(text);
  }
  return (text) => text.includes(entry);
}

/**
 * Applied before the LLM call. Blocks the request if any inputDenylist
 * entry matches the inbound message. Short-circuits with a canned refusal.
 */
export function applyInputGuardrails(
  text: string,
  cfg: GuardrailsConfig,
): GuardrailResult {
  for (const entry of cfg.inputDenylist) {
    if (makeMatcher(entry)(text)) {
      return { blocked: true, refusal: CANNED_REFUSAL };
    }
  }
  return { blocked: false };
}

/**
 * Applied after the LLM call. Runs:
 *  1. PII scrubbing (when piiRedaction = true)
 *  2. outputDenylist check — replaces with refusal if matched
 *
 * Operates on the serialised string of the output object; returns the
 * (possibly mutated) output object with the same shape.
 */
export function applyOutputGuardrails(
  output: Record<string, unknown>,
  cfg: GuardrailsConfig,
): Record<string, unknown> {
  let serialised = JSON.stringify(output);

  if (cfg.piiRedaction) {
    for (const { label, pattern } of PII_PATTERNS) {
      serialised = serialised.replace(
        pattern,
        `[REDACTED_${label.toUpperCase()}]`,
      );
    }
  }

  for (const entry of cfg.outputDenylist) {
    if (makeMatcher(entry)(serialised)) {
      return { text: CANNED_REFUSAL };
    }
  }

  try {
    return JSON.parse(serialised) as Record<string, unknown>;
  } catch {
    // Shouldn't happen, but guard against corrupted JSON
    return output;
  }
}
