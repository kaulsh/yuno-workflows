-- DropIndex
DROP INDEX "memory_embedding_hnsw";

-- CreateTable
CREATE TABLE "WorkflowRunEvent" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowRunEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkflowRunEvent_runId_at_idx" ON "WorkflowRunEvent"("runId", "at");

-- AddForeignKey
ALTER TABLE "WorkflowRunEvent" ADD CONSTRAINT "WorkflowRunEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "WorkflowRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
