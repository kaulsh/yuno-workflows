import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { ListRunsQuerySchema, UuidSchema } from "@workspace/shared";
import type { ApiDeps } from "../deps.js";
import { handleRouteError } from "../lib/errors.js";
import { loadRunSnapshot } from "../lib/snapshot.js";
import { serializeRun } from "../lib/serializers.js";
import { createRunStreamHandler } from "../sse/run-stream.js";

const idParam = z.object({ id: UuidSchema });

export function runsRoutes(deps: ApiDeps): Hono {
  const { prisma, rmq } = deps;
  const app = new Hono();

  app.get("/", zValidator("query", ListRunsQuerySchema), async (c) => {
    try {
      const query = c.req.valid("query");
      const cursorRun = query.cursor
        ? await prisma.workflowRun.findUnique({
            where: { id: query.cursor },
          })
        : null;

      if (query.cursor && !cursorRun) {
        return c.json(
          { error: { code: "bad_request", message: "Invalid cursor" } },
          400,
        );
      }

      const rows = await prisma.workflowRun.findMany({
        where: {
          ...(query.workflowId ? { workflowId: query.workflowId } : {}),
          ...(query.status ? { status: query.status } : {}),
          ...(cursorRun
            ? {
                OR: [
                  { startedAt: { lt: cursorRun.startedAt } },
                  {
                    startedAt: cursorRun.startedAt,
                    id: { lt: cursorRun.id },
                  },
                ],
              }
            : {}),
        },
        orderBy: [{ startedAt: "desc" }, { id: "desc" }],
        take: query.limit + 1,
      });

      const hasMore = rows.length > query.limit;
      const page = hasMore ? rows.slice(0, query.limit) : rows;
      const nextCursor = hasMore ? page[page.length - 1]!.id : undefined;

      return c.json({
        runs: page.map(serializeRun),
        nextCursor,
      });
    } catch (err) {
      return handleRouteError(c, err);
    }
  });

  app.get("/:id", zValidator("param", idParam), async (c) => {
    try {
      const { id } = c.req.valid("param");
      const snapshot = await loadRunSnapshot(prisma, id);
      if (!snapshot) {
        return c.json(
          { error: { code: "not_found", message: "Run not found" } },
          404,
        );
      }
      return c.json(snapshot);
    } catch (err) {
      return handleRouteError(c, err);
    }
  });

  app.get("/:id/stream", zValidator("param", idParam), async (c) => {
    try {
      const { id } = c.req.valid("param");
      return await createRunStreamHandler(rmq, prisma, id);
    } catch (err) {
      return handleRouteError(c, err);
    }
  });

  return app;
}
