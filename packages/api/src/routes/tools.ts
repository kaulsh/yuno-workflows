import { Hono } from "hono";
import { TOOLS_CATALOG } from "@workspace/shared";

export function toolsRoutes(): Hono {
  const app = new Hono();

  app.get("/", (c) => c.json({ tools: TOOLS_CATALOG }));

  return app;
}
