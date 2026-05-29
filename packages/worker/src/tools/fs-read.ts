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
});

export const fsReadTool = new ToolDefinition(
  "fs.read",
  "Read the contents of a file from the run-scoped workspace directory.",
  inputSchema,
  async (input, ctx) => {
    try {
      const resolved = sandboxedPath(ctx.runId, input.path);
      const content = await fs.readFile(resolved, "utf-8");
      return content;
    } catch (err) {
      return `Error: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
);
