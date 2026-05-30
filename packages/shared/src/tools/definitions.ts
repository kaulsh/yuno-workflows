import { z } from "zod";

export type ToolDef = {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: z.ZodType;
};

export const fsReadToolDef = {
  name: "fs_read",
  description:
    "Read the contents of a file from the run-scoped workspace directory.",
  inputSchema: z.object({
    path: z
      .string()
      .min(1)
      .describe("Relative file path within the run workspace"),
  }),
} satisfies ToolDef;

export const fsWriteToolDef = {
  name: "fs_write",
  description:
    "Write content to a file in the run-scoped workspace directory. Creates parent directories as needed.",
  inputSchema: z.object({
    path: z
      .string()
      .min(1)
      .describe("Relative file path within the run workspace"),
    content: z.string().describe("Content to write to the file"),
  }),
} satisfies ToolDef;

export const bashExecToolDef = {
  name: "bash_exec",
  description:
    "Run bash command(s) sandboxed to the run's workspace directory on the real filesystem. " +
    "Supports full bash syntax and a broad set of unix commands (cat, grep, awk, sed, jq, wc, head, tail, sort, uniq, etc.).",
  inputSchema: z.object({
    command: z
      .string()
      .min(1)
      .describe(
        "Bash command(s) to run. Full shell syntax supported (pipes, redirections, &&, etc.). " +
          "Sandboxed to the run workspace directory on the real filesystem.",
      ),
  }),
} satisfies ToolDef;

export const httpFetchToolDef = {
  name: "http_fetch",
  description:
    "Perform an HTTP GET request and return the response body as text.",
  inputSchema: z.object({
    url: z.string().url().describe("The URL to fetch (HTTP GET)."),
  }),
} satisfies ToolDef;

export const memoryRecallToolDef = {
  name: "memory_recall",
  description:
    "Search agent memory for relevant past information using semantic similarity or recency ordering.",
  inputSchema: z.object({
    query: z.string().min(1).describe("The query to search memory for."),
    k: z
      .number()
      .int()
      .positive()
      .optional()
      .describe(
        "Number of memories to retrieve. Defaults to the agent's configured k.",
      ),
  }),
} satisfies ToolDef;

export const memoryWriteToolDef = {
  name: "memory_write",
  description:
    "Persist a piece of information to agent memory so it can be recalled in future invocations.",
  inputSchema: z.object({
    content: z.string().min(1).describe("The information to store in memory."),
    tags: z
      .array(z.string())
      .optional()
      .describe("Optional tags for categorising this memory."),
  }),
} satisfies ToolDef;

export const messageSendToTelegramToolDef = {
  name: "message_send_to_telegram",
  description:
    "Send a message to the Telegram chat that triggered this workflow run.",
  inputSchema: z.object({
    text: z
      .string()
      .min(1)
      .describe("Message text to send to the Telegram chat."),
  }),
} satisfies ToolDef;

export const webSearchToolDef = {
  name: "web_search",
  description:
    "Search the web using Google (via SerpAPI) and return a list of organic results with titles, URLs, and snippets. " +
    "After getting results, use the `http_fetch` tool to fetch the full content of relevant URLs when more detail is needed.",
  inputSchema: z.object({
    query: z.string().min(1).describe("The search query to look up."),
    num_results: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional()
      .describe("Number of results to return (1-10). Defaults to 5."),
  }),
} satisfies ToolDef;

/** Canonical tool list order (matches worker registry). */
export const ALL_TOOL_DEFS = [
  fsReadToolDef,
  fsWriteToolDef,
  bashExecToolDef,
  webSearchToolDef,
  httpFetchToolDef,
  memoryRecallToolDef,
  memoryWriteToolDef,
  messageSendToTelegramToolDef,
] as const satisfies readonly ToolDef[];
