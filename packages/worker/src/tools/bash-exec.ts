import fs from "node:fs/promises";
import path from "node:path";
import { Bash, ReadWriteFs } from "just-bash";
import { z } from "zod";
import { ToolDefinition } from "./types.js";

const SANDBOX_ROOT = path.resolve(process.cwd(), "workspace");

const inputSchema = z.object({
  command: z
    .string()
    .min(1)
    .describe(
      "Bash command(s) to run. Full shell syntax supported (pipes, redirections, &&, etc.). " +
        "Sandboxed to the run workspace directory on the real filesystem.",
    ),
});

export const bashExecTool = new ToolDefinition(
  "bash.exec",
  "Run bash command(s) sandboxed to the run's workspace directory on the real filesystem. " +
    "Supports full bash syntax and a broad set of unix commands (cat, grep, awk, sed, jq, wc, head, tail, sort, uniq, etc.).",
  inputSchema,
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
