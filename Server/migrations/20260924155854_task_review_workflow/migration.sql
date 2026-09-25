-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'SUBMITTED_FOR_REVIEW';
ALTER TYPE "ActivityType" ADD VALUE 'TASK_APPROVED';
ALTER TYPE "ActivityType" ADD VALUE 'CHANGES_REQUESTED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'REVIEW_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'TASK_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'CHANGES_REQUESTED';

-- AlterEnum
ALTER TYPE "TaskStatus" ADD VALUE 'IN_REVIEW';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Task_workspaceId_status_idx" ON "Task"("workspaceId", "status");
