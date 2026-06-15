-- ShortLinkTarget enum
CREATE TYPE "ShortLinkTarget" AS ENUM ('project', 'user');

-- ShortLink
CREATE TABLE "ShortLink" (
  "code"      TEXT NOT NULL,
  "target"    "ShortLinkTarget" NOT NULL,
  "projectId" TEXT,
  "userId"    TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShortLink_pkey" PRIMARY KEY ("code")
);

CREATE INDEX "ShortLink_target_projectId_idx" ON "ShortLink"("target", "projectId");
CREATE INDEX "ShortLink_target_userId_idx" ON "ShortLink"("target", "userId");

-- UserLink
CREATE TABLE "UserLink" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "label"     TEXT NOT NULL,
  "url"       TEXT NOT NULL,
  "position"  INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserLink_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "UserLink" ADD CONSTRAINT "UserLink_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "UserLink_userId_position_idx" ON "UserLink"("userId", "position");
