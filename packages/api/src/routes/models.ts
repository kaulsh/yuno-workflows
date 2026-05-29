import { Hono } from "hono";
import { listAvailableModels } from "../lib/models-available.js";

export function modelsRoutes(): Hono {
  const app = new Hono();

  app.get("/", (c) => c.json({ models: listAvailableModels() }));

  return app;
}
