import { z } from "zod";
import { ToolDefinition } from "./types.js";

export const loadSkillTool = new ToolDefinition(
  "load_skill",
  "Load the full instructions for this agent's skill. Call this before applying skill-specific guidance.",
  z.object({}),
  async (_input, ctx): Promise<string> => {
    const skill = ctx.loadableSkill;
    if (!skill) {
      return "Error: no skill is available to load for this invocation.";
    }

    return [
      `# ${skill.name}`,
      skill.description,
      skill.instructions,
    ].join("\n\n");
  },
);
