import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { absoluteUrl } from "@/lib/site";

// Regenerate at most once a day — the map refreshes on the first request after
// the window elapses (not per request), so the cost is one query-batch/day.
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/board"), changeFrequency: "daily", priority: 0.9 },
    { url: absoluteUrl("/terms"), changeFrequency: "yearly", priority: 0.2 },
    { url: absoluteUrl("/privacy"), changeFrequency: "yearly", priority: 0.2 },
    { url: absoluteUrl("/cookies"), changeFrequency: "yearly", priority: 0.2 },
    { url: absoluteUrl("/dmca"), changeFrequency: "yearly", priority: 0.2 },
  ];

  const [projects, announcements, users] = await Promise.all([
    prisma.project.findMany({
      where: { moderationStatus: "published" },
      select: { slug: true, updatedAt: true },
    }),
    prisma.announcement.findMany({
      where: {
        moderationStatus: "published",
        publishedAt: { not: null },
        project: { moderationStatus: "published" },
      },
      select: { id: true, publishedAt: true, project: { select: { slug: true } } },
    }),
    prisma.user.findMany({
      where: { githubLogin: { not: null } },
      select: { githubLogin: true, updatedAt: true },
    }),
  ]);

  const projectRoutes: MetadataRoute.Sitemap = projects.map((p) => ({
    url: absoluteUrl(`/p/${p.slug}`),
    lastModified: p.updatedAt,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const announcementRoutes: MetadataRoute.Sitemap = announcements.map((a) => ({
    url: absoluteUrl(`/p/${a.project.slug}/announcements/${a.id}`),
    lastModified: a.publishedAt ?? undefined,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const userRoutes: MetadataRoute.Sitemap = users.map((u) => ({
    url: absoluteUrl(`/u/${u.githubLogin}`),
    lastModified: u.updatedAt,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  return [...staticRoutes, ...projectRoutes, ...announcementRoutes, ...userRoutes];
}
