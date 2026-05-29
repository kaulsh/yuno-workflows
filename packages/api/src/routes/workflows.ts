import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { WorkflowStartPublisher } from "@workspace/rmq";
import {
  CloneWorkflowInputSchema,
  CreateWorkflowInputSchema,
  RunWorkflowInputSchema,
  UpdateWorkflowInputSchema,
  UuidSchema,
} from "@workspace/shared";
import type { ApiDeps } from "../deps.js";
import { handleRouteError } from "../lib/errors.js";
import { serializeRun, serializeWorkflow } from "../lib/serializers.js";
import { assertWorkflowAgentIdsExist } from "../lib/workflow-agents.js";

const idParam = z.object({ id: UuidSchema });

export function workflowsRoutes(deps: ApiDeps): Hono {
  const { prisma, publishChannel } = deps;
  const app = new Hono();

  app.get("/", async (c) => {
    try {
      const rows = await prisma.workflow.findMany({
        orderBy: { name: "asc" },
      });
      return c.json(rows.map(serializeWorkflow));
    } catch (err) {
      return handleRouteError(c, err);
    }
  });

  app.post("/", zValidator("json", CreateWorkflowInputSchema), async (c) => {
    try {
      const body = c.req.valid("json");
      await assertWorkflowAgentIdsExist(prisma, body.nodes);
      const row = await prisma.workflow.create({
        data: {
          name: body.name,
          description: body.description,
          triggerType: body.triggerType,
          triggerConfig: body.triggerConfig,
          nodes: body.nodes as object,
          edges: body.edges as object,
          entryNodeId: body.entryNodeId,
          maxSteps: body.maxSteps,
          isTemplate: body.isTemplate ?? false,
        },
      });
      return c.json(serializeWorkflow(row), 201);
    } catch (err) {
      return handleRouteError(c, err);
    }
  });

  app.get("/:id", zValidator("param", idParam), async (c) => {
    try {
      const { id } = c.req.valid("param");
      const row = await prisma.workflow.findUnique({ where: { id } });
      if (!row) {
        return c.json(
          { error: { code: "not_found", message: "Workflow not found" } },
          404,
        );
      }
      return c.json(serializeWorkflow(row));
    } catch (err) {
      return handleRouteError(c, err);
    }
  });

  app.put(
    "/:id",
    zValidator("param", idParam),
    zValidator("json", UpdateWorkflowInputSchema),
    async (c) => {
      try {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        await assertWorkflowAgentIdsExist(prisma, body.nodes);
        const row = await prisma.workflow.update({
          where: { id },
          data: {
            name: body.name,
            description: body.description,
            triggerType: body.triggerType,
            triggerConfig: body.triggerConfig,
            nodes: body.nodes as object,
            edges: body.edges as object,
            entryNodeId: body.entryNodeId,
            maxSteps: body.maxSteps,
            isTemplate: body.isTemplate ?? false,
          },
        });
        return c.json(serializeWorkflow(row));
      } catch (err) {
        return handleRouteError(c, err);
      }
    },
  );

  app.post(
    "/:id/clone",
    zValidator("param", idParam),
    zValidator("json", CloneWorkflowInputSchema),
    async (c) => {
      try {
        const { id } = c.req.valid("param");
        const { name } = c.req.valid("json");
        const source = await prisma.workflow.findUnique({ where: { id } });
        if (!source) {
          return c.json(
            { error: { code: "not_found", message: "Workflow not found" } },
            404,
          );
        }
        const row = await prisma.workflow.create({
          data: {
            name,
            description: source.description,
            triggerType: source.triggerType,
            triggerConfig: source.triggerConfig as object,
            nodes: source.nodes as object,
            edges: source.edges as object,
            entryNodeId: source.entryNodeId,
            maxSteps: source.maxSteps,
            isTemplate: false,
          },
        });
        return c.json(serializeWorkflow(row), 201);
      } catch (err) {
        return handleRouteError(c, err);
      }
    },
  );

  app.post(
    "/:id/run",
    zValidator("param", idParam),
    zValidator("json", RunWorkflowInputSchema),
    async (c) => {
      try {
        const { id: workflowId } = c.req.valid("param");
        const body = c.req.valid("json");

        await prisma.workflow.findUniqueOrThrow({ where: { id: workflowId } });

        const run = await prisma.workflowRun.create({
          data: {
            workflowId,
            status: "pending",
            triggerContext: { source: "manual" },
            initialInput: body.initialInput ?? null,
          },
        });

        await WorkflowStartPublisher(publishChannel).publish(
          {
            workflowId,
            runId: run.id,
            initialInput: body.initialInput,
            triggerContext: { source: "manual" },
          },
          ["start"],
        );

        return c.json(serializeRun(run), 202);
      } catch (err) {
        return handleRouteError(c, err);
      }
    },
  );

  return app;
}
