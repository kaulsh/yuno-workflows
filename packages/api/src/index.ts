import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@workspace/db-adapter";
import { MODELS } from "@workspace/shared";

const pool = new Pool({ connectionString: process.env["DATABASE_URL"] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const app = new Hono();

app.get("/", (c) => {
  return c.json({ message: "Hello from Yuno API" });
});

app.get("/health", async (c) => {
  const agentCount = await prisma.agent.count();
  return c.json({
    status: "ok",
    agentCount,
    models: Object.keys(MODELS),
  });
});

serve({ fetch: app.fetch, port: 3000 }, (info) => {
  console.log(`API running on http://localhost:${info.port}`);
});
