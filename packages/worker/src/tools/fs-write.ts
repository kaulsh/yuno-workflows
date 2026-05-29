import fs from "node:fs/promises";
import path from "node:path";
import { fsWriteToolDef } from "@workspace/shared/tools";
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

export const fsWriteTool = new ToolDefinition(
  fsWriteToolDef.name,
  fsWriteToolDef.description,
  fsWriteToolDef.inputSchema,
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
