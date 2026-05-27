import { z } from "zod";

import { JsonObjectSchema } from "./common.js";

export const ToolInfoSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  inputSchema: JsonObjectSchema,
});

export const ToolsListResponseSchema = z.object({
  tools: z.array(ToolInfoSchema),
});

export type ToolInfo = z.infer<typeof ToolInfoSchema>;
export type ToolsListResponse = z.infer<typeof ToolsListResponseSchema>;
