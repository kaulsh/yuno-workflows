import { httpFetchToolDef } from "@workspace/shared/tools";
import { ToolDefinition } from "./types.js";

export const httpFetchTool = new ToolDefinition(
  httpFetchToolDef.name,
  httpFetchToolDef.description,
  httpFetchToolDef.inputSchema,
  async (input): Promise<string> => {
    try {
      const res = await fetch(input.url, {
        method: "GET",
        headers: { "User-Agent": "a-very-cool-agent/0.1.0" },
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        return `Error: HTTP ${res.status} ${res.statusText}`;
      }

      const contentType = res.headers.get("content-type") ?? "";
      if (
        !contentType.includes("text/") &&
        !contentType.includes("application/json") &&
        !contentType.includes("application/xml")
      ) {
        return `Error: unsupported content-type '${contentType}'. Only text, JSON, and XML are returned.`;
      }

      const MAX_CHARS = 20_000;
      const text = await res.text();
      if (text.length > MAX_CHARS) {
        return (
          text.slice(0, MAX_CHARS) +
          `\n\n[truncated — response exceeded ${MAX_CHARS} chars]`
        );
      }
      return text;
    } catch (err) {
      return `Error: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
);
