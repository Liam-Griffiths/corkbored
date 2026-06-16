-- Promote tags from free-form strings on ProjectTag to first-class Tag rows.

-- CreateEnum
CREATE TYPE "TagStatus" AS ENUM ('active', 'hidden');

-- AlterEnum: tags become reportable
ALTER TYPE "ReportSubjectType" ADD VALUE 'tag';

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" "TagStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- CreateIndex
CREATE INDEX "Tag_status_idx" ON "Tag"("status");

-- Backfill: one canonical Tag per normalized slug from existing ProjectTag strings.
-- Normalization mirrors normalizeTag() in lib/tags.ts: lowercase, strip to [a-z0-9.+#-].
INSERT INTO "Tag" ("id", "slug", "label", "status", "createdAt")
SELECT 'tag_' || md5(slug), slug, label, 'active', CURRENT_TIMESTAMP
FROM (
    SELECT
        regexp_replace(lower(btrim("tag")), '[^a-z0-9.+#-]', '', 'g') AS slug,
        min(btrim("tag")) AS label
    FROM "ProjectTag"
    WHERE regexp_replace(lower(btrim("tag")), '[^a-z0-9.+#-]', '', 'g') <> ''
    GROUP BY 1
) s;

-- Add the foreign key column and point each join row at its canonical Tag.
ALTER TABLE "ProjectTag" ADD COLUMN "tagId" TEXT;

UPDATE "ProjectTag" pt
SET "tagId" = t."id"
FROM "Tag" t
WHERE t."slug" = regexp_replace(lower(btrim(pt."tag")), '[^a-z0-9.+#-]', '', 'g');

-- Drop rows that normalized to nothing (no canonical tag exists for them).
DELETE FROM "ProjectTag" WHERE "tagId" IS NULL;

-- Collapse duplicates created when distinct strings normalized to the same slug.
DELETE FROM "ProjectTag" a
USING "ProjectTag" b
WHERE a."projectId" = b."projectId"
  AND a."tagId" = b."tagId"
  AND a.ctid > b.ctid;

-- Swap the primary key from (projectId, tag) to (projectId, tagId).
ALTER TABLE "ProjectTag" DROP CONSTRAINT "ProjectTag_pkey";
DROP INDEX IF EXISTS "ProjectTag_tag_idx";
ALTER TABLE "ProjectTag" DROP COLUMN "tag";
ALTER TABLE "ProjectTag" ALTER COLUMN "tagId" SET NOT NULL;
ALTER TABLE "ProjectTag" ADD CONSTRAINT "ProjectTag_pkey" PRIMARY KEY ("projectId", "tagId");

-- CreateIndex
CREATE INDEX "ProjectTag_tagId_idx" ON "ProjectTag"("tagId");

-- AddForeignKey
ALTER TABLE "ProjectTag" ADD CONSTRAINT "ProjectTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
