import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import {
  CreateAgentInputSchema,
  UpdateAgentInputSchema,
  UuidSchema,
} from "@workspace/shared";
import type { ApiDeps } from "../deps.js";
import { handleRouteError } from "../lib/errors.js";
import { serializeAgent } from "../lib/serializers.js";

const idParam = z.object({ id: UuidSchema });

export function agentsRoutes({ prisma }: ApiDeps): Hono {
  const app = new Hono();

  app.get("/", async (c) => {
    try {
      const rows = await prisma.agent.findMany({ orderBy: { name: "asc" } });
      return c.json(rows.map(serializeAgent));
    } catch (err) {
      return handleRouteError(c, err);
    }
  });

  app.post("/", zValidator("json", CreateAgentInputSchema), async (c) => {
    try {
      const body = c.req.valid("json");
      const row = await prisma.agent.create({
        data: {
          name: body.name,
          role: body.role,
          systemPrompt: body.systemPrompt,
          model: body.model,
          temperature: body.temperature,
          maxOutputTokens: body.maxOutputTokens,
          tools: body.tools,
          skillIds: body.skillIds,
          memory: body.memory,
          guardrails: body.guardrails,
          channels: body.channels,
          scheduleCron: body.scheduleCron ?? null,
        },
      });
      return c.json(serializeAgent(row), 201);
    } catch (err) {
      return handleRouteError(c, err);
    }
  });

  app.get("/:id", zValidator("param", idParam), async (c) => {
    try {
      const { id } = c.req.valid("param");
      const row = await prisma.agent.findUnique({ where: { id } });
      if (!row) {
        return c.json(
          { error: { code: "not_found", message: "Agent not found" } },
          404,
        );
      }
      return c.json(serializeAgent(row));
    } catch (err) {
      return handleRouteError(c, err);
    }
  });

  app.put(
    "/:id",
    zValidator("param", idParam),
    zValidator("json", UpdateAgentInputSchema),
    async (c) => {
      try {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const row = await prisma.agent.update({
          where: { id },
          data: {
            name: body.name,
            role: body.role,
            systemPrompt: body.systemPrompt,
            model: body.model,
            temperature: body.temperature,
            maxOutputTokens: body.maxOutputTokens,
            tools: body.tools,
            skillIds: body.skillIds,
            memory: body.memory,
            guardrails: body.guardrails,
            channels: body.channels,
            scheduleCron: body.scheduleCron ?? null,
          },
        });
        return c.json(serializeAgent(row));
      } catch (err) {
        return handleRouteError(c, err);
      }
    },
  );

  app.delete("/:id", zValidator("param", idParam), async (c) => {
    try {
      const { id } = c.req.valid("param");
      await prisma.agent.delete({ where: { id } });
      return c.body(null, 204);
    } catch (err) {
      return handleRouteError(c, err);
    }
  });

  return app;
}
