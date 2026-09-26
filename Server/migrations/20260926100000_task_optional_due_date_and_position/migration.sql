-- AlterTable: due date is now optional
ALTER TABLE "Task" ALTER COLUMN "due_date" DROP NOT NULL;

-- AlterTable: manual ordering within a project
ALTER TABLE "Task" ADD COLUMN "position" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Backfill: keep today's order (oldest first) for existing tasks
UPDATE "Task" AS t
SET "position" = o.rn
FROM (
    SELECT "id", ROW_NUMBER() OVER (PARTITION BY "projectId" ORDER BY "createdAt") AS rn
    FROM "Task"
) AS o
WHERE t."id" = o."id";

-- Replace the projectId index with one that also serves ordered reads
DROP INDEX "Task_projectId_idx";
CREATE INDEX "Task_projectId_position_idx" ON "Task"("projectId", "position");
