-- AlterTable
ALTER TABLE "Event" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Event_projectId_isPublic_startAt_idx" ON "Event"("projectId", "isPublic", "startAt");
