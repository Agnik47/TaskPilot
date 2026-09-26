-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'BLOCKER_ADDED';
ALTER TYPE "NotificationType" ADD VALUE 'BLOCKER_NUDGE';
ALTER TYPE "NotificationType" ADD VALUE 'BLOCKER_RESOLVED';

-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'BLOCKER_ADDED';
ALTER TYPE "ActivityType" ADD VALUE 'BLOCKER_RESOLVED';

-- CreateTable
CREATE TABLE "TaskBlocker" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "waitingOnId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastNudgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolutionNote" TEXT,

    CONSTRAINT "TaskBlocker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskBlocker_taskId_idx" ON "TaskBlocker"("taskId");

-- CreateIndex
CREATE INDEX "TaskBlocker_waitingOnId_resolvedAt_idx" ON "TaskBlocker"("waitingOnId", "resolvedAt");

-- AddForeignKey
ALTER TABLE "TaskBlocker" ADD CONSTRAINT "TaskBlocker_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskBlocker" ADD CONSTRAINT "TaskBlocker_waitingOnId_fkey" FOREIGN KEY ("waitingOnId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskBlocker" ADD CONSTRAINT "TaskBlocker_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskBlocker" ADD CONSTRAINT "TaskBlocker_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
