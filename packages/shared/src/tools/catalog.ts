import { z } from "zod";

import { ToolInfoSchema, type ToolInfo } from "../schemas/tool.js";
import { ALL_TOOL_DEFS } from "./definitions.js";

function toToolInfo(def: (typeof ALL_TOOL_DEFS)[number]): ToolInfo {
  return ToolInfoSchema.parse({
    name: def.name,
    description: def.description,
    inputSchema: z.toJSONSchema(def.inputSchema),
  });
}

/** Static tool metadata for GET /api/tools (derived from shared Zod definitions). */
export const TOOLS_CATALOG: ToolInfo[] = ALL_TOOL_DEFS.map(toToolInfo);
