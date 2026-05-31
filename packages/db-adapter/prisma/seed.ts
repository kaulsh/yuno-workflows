import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { applyCopyBlocks, TRUNCATE_SQL } from "../seed/lib/apply-blocks.js";
import { requireDatabaseUrl } from "../seed/lib/load-env.js";
import { parsePgCopyDump } from "../seed/lib/parse-pg-copy.js";

const DATA_SQL = join(import.meta.dirname, "../seed/data.sql");

async function main(): Promise<void> {
  const databaseUrl = requireDatabaseUrl();

  const sql = readFileSync(DATA_SQL, "utf8");
  const blocks = parsePgCopyDump(sql);

  const pool = new Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    console.error("seed: truncating app tables…");
    await prisma.$executeRawUnsafe(TRUNCATE_SQL);

    console.error(`seed: loading ${blocks.length} table(s) from data.sql…`);
    await applyCopyBlocks(prisma, blocks);

    const counts = await Promise.all([
      prisma.skill.count(),
      prisma.agent.count(),
      prisma.workflow.count(),
      prisma.workflowRun.count(),
      prisma.memory.count(),
    ]);
    console.error(
      `seed: done (skills=${counts[0]} agents=${counts[1]} workflows=${counts[2]} runs=${counts[3]} memories=${counts[4]})`,
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
