import { Hono } from "hono";
import { cors } from "hono/cors";
import type { ApiDeps } from "./deps.js";
import { agentsRoutes } from "./routes/agents.js";
import { modelsRoutes } from "./routes/models.js";
import { runsRoutes } from "./routes/runs.js";
import { skillsRoutes } from "./routes/skills.js";
import { toolsRoutes } from "./routes/tools.js";
import { workflowsRoutes } from "./routes/workflows.js";

export function createApp(deps: ApiDeps): Hono {
  const app = new Hono();

  app.use(
    "/api/*",
    cors({
      origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    }),
  );

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.route("/api/agents", agentsRoutes(deps));
  app.route("/api/skills", skillsRoutes(deps));
  app.route("/api/workflows", workflowsRoutes(deps));
  app.route("/api/runs", runsRoutes(deps));
  app.route("/api/tools", toolsRoutes());
  app.route("/api/models", modelsRoutes());

  return app;
}
