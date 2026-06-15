-- Add new NotificationKind values
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'new_project';
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'new_follower';

-- ProjectFollow
CREATE TABLE "ProjectFollow" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectFollow_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ProjectFollow" ADD CONSTRAINT "ProjectFollow_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectFollow" ADD CONSTRAINT "ProjectFollow_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ProjectFollow_userId_projectId_key" ON "ProjectFollow"("userId", "projectId");
CREATE INDEX "ProjectFollow_projectId_idx" ON "ProjectFollow"("projectId");

-- UserFollow
CREATE TABLE "UserFollow" (
  "id"          TEXT NOT NULL,
  "followerId"  TEXT NOT NULL,
  "followingId" TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserFollow_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "UserFollow" ADD CONSTRAINT "UserFollow_followerId_fkey"
  FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserFollow" ADD CONSTRAINT "UserFollow_followingId_fkey"
  FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "UserFollow_followerId_followingId_key" ON "UserFollow"("followerId", "followingId");
CREATE INDEX "UserFollow_followingId_idx" ON "UserFollow"("followingId");
