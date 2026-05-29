import fs from "node:fs/promises";
import path from "node:path";
import { Bash, ReadWriteFs } from "just-bash";
import { bashExecToolDef } from "@workspace/shared/tools";
import { ToolDefinition } from "./types.js";

const SANDBOX_ROOT = path.resolve(process.cwd(), "workspace");

export const bashExecTool = new ToolDefinition(
  bashExecToolDef.name,
  bashExecToolDef.description,
  bashExecToolDef.inputSchema,
  async (input): Promise<string> => {
    await fs.mkdir(SANDBOX_ROOT, { recursive: true });

    const bash = new Bash({
      fs: new ReadWriteFs({ root: SANDBOX_ROOT }),
      cwd: "/",
      executionLimits: { maxCommandCount: 500 },
    });

    try {
      const { stdout, stderr, exitCode } = await bash.exec(input.command);

      const out = stdout.trim();
      const err = stderr.trim();

      const body = [
        out && `stdout:\n${out}`,
        err && `stderr:\n${err}`,
        exitCode !== 0 && `exit code: ${exitCode}`,
      ]
        .filter(Boolean)
        .join("\n\n");

      return body || "(no output)";
    } catch (err) {
      return `Error: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
);
