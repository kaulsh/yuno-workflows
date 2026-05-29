import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import {
  CreateSkillInputSchema,
  UpdateSkillInputSchema,
  UuidSchema,
} from "@workspace/shared";
import type { ApiDeps } from "../deps.js";
import { handleRouteError } from "../lib/errors.js";
import { serializeSkill } from "../lib/serializers.js";

const idParam = z.object({ id: UuidSchema });

export function skillsRoutes({ prisma }: ApiDeps): Hono {
  const app = new Hono();

  app.get("/", async (c) => {
    try {
      const rows = await prisma.skill.findMany({ orderBy: { name: "asc" } });
      return c.json(rows.map(serializeSkill));
    } catch (err) {
      return handleRouteError(c, err);
    }
  });

  app.post("/", zValidator("json", CreateSkillInputSchema), async (c) => {
    try {
      const body = c.req.valid("json");
      const row = await prisma.skill.create({ data: body });
      return c.json(serializeSkill(row), 201);
    } catch (err) {
      return handleRouteError(c, err);
    }
  });

  app.put(
    "/:id",
    zValidator("param", idParam),
    zValidator("json", UpdateSkillInputSchema),
    async (c) => {
      try {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const row = await prisma.skill.update({ where: { id }, data: body });
        return c.json(serializeSkill(row));
      } catch (err) {
        return handleRouteError(c, err);
      }
    },
  );

  app.delete("/:id", zValidator("param", idParam), async (c) => {
    try {
      const { id } = c.req.valid("param");
      await prisma.skill.delete({ where: { id } });
      return c.body(null, 204);
    } catch (err) {
      return handleRouteError(c, err);
    }
  });

  return app;
}
