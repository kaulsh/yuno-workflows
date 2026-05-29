import fs from "node:fs/promises";
import path from "node:path";
import { fsReadToolDef } from "@workspace/shared/tools";
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

export const fsReadTool = new ToolDefinition(
  fsReadToolDef.name,
  fsReadToolDef.description,
  fsReadToolDef.inputSchema,
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
