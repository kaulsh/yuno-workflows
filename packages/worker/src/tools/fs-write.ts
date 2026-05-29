import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { ToolDefinition } from "./types.js";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "workspace");

function sandboxedPath(runId: string, filePath: string): string {
  const base = path.join(WORKSPACE_ROOT, runId);
  const resolved = path.resolve(base, filePath);
  if (!resolved.startsWith(base + path.sep) && resolved !== base) {
    throw new Error(`Path escape attempt: ${filePath}`);
  }
  return resolved;
}

const inputSchema = z.object({
  path: z.string().min(1).describe("Relative file path within the run workspace"),
  content: z.string().describe("Content to write to the file"),
});

export const fsWriteTool = new ToolDefinition(
  "fs.write",
  "Write content to a file in the run-scoped workspace directory. Creates parent directories as needed.",
  inputSchema,
  async (input, ctx) => {
    try {
      const resolved = sandboxedPath(ctx.runId, input.path);
      await fs.mkdir(path.dirname(resolved), { recursive: true });
      await fs.writeFile(resolved, input.content, "utf-8");
      return `Written ${input.content.length} bytes to ${input.path}`;
    } catch (err) {
      return `Error: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
);
