import { z } from "zod";

import { IsoDateTimeSchema, UuidSchema } from "./common.js";

export const SkillSchema = z.object({
  id: UuidSchema,
  name: z.string().min(1),
  description: z.string(),
  instructions: z.string(),
  requiredTools: z.array(z.string()).default([]),
  createdAt: IsoDateTimeSchema,
});

export const CreateSkillInputSchema = SkillSchema.omit({
  id: true,
  createdAt: true,
});

export const UpdateSkillInputSchema = CreateSkillInputSchema;

export type Skill = z.infer<typeof SkillSchema>;
export type CreateSkillInput = z.infer<typeof CreateSkillInputSchema>;
export type UpdateSkillInput = z.infer<typeof UpdateSkillInputSchema>;
