import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";

/** Canonical tag identity: lowercase, stripped to [a-z0-9.+#-]. Mirrors the SQL in the tags migration. */
export function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9.+#-]/g, "");
}

/**
 * Upsert canonical Tag rows for the given labels and return their ids,
 * deduped by slug and preserving first-seen order. Empty/invalid labels are dropped.
 */
export async function upsertTagsByLabel(
  tx: Prisma.TransactionClient,
  labels: string[],
): Promise<string[]> {
  const bySlug = new Map<string, string>();
  for (const label of labels) {
    const slug = normalizeTag(label);
    if (slug && !bySlug.has(slug)) bySlug.set(slug, label.trim().slice(0, 30));
  }

  const ids: string[] = [];
  for (const [slug, label] of bySlug) {
    const tag = await tx.tag.upsert({
      where: { slug },
      create: { slug, label },
      update: {},
      select: { id: true },
    });
    ids.push(tag.id);
  }
  return ids;
}

export interface PopularTag {
  id: string;
  slug: string;
  label: string;
}

const POPULAR_LIMIT = 24;
export const POPULAR_TAGS_CACHE_TAG = "popular-tags";

async function computePopularTags(): Promise<PopularTag[]> {
  // Count tag usage only across visible projects, ordered by popularity.
  const grouped = await prisma.projectTag.groupBy({
    by: ["tagId"],
    where: { project: { moderationStatus: "published" } },
    _count: { tagId: true },
    orderBy: { _count: { tagId: "desc" } },
    take: POPULAR_LIMIT * 2, // over-fetch so hidden tags don't shrink the list
  });
  if (grouped.length === 0) return [];

  const tags = await prisma.tag.findMany({
    where: { id: { in: grouped.map((g) => g.tagId) }, status: "active" },
    select: { id: true, slug: true, label: true },
  });
  const byId = new Map(tags.map((t) => [t.id, t]));

  return grouped
    .map((g) => byId.get(g.tagId))
    .filter((t): t is PopularTag => Boolean(t))
    .slice(0, POPULAR_LIMIT);
}

/**
 * Popular tags for the board, cached so frequent board loads don't re-aggregate.
 * Recomputed at most every 5 minutes, or immediately when revalidateTag is called
 * after a tag set changes.
 */
export const getPopularTags = unstable_cache(computePopularTags, ["popular-tags-v1"], {
  revalidate: 300,
  tags: [POPULAR_TAGS_CACHE_TAG],
});
