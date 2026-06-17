import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";

export type FeedItemType = "announcement" | "event" | "thread" | "reply" | "task";

export interface FeedActor {
  displayName: string | null;
  githubLogin: string | null;
  avatarUrl: string | null;
}

export interface FeedItem {
  id: string;
  type: FeedItemType;
  at: number; // epoch ms — a plain number so it survives unstable_cache's JSON serialization
  actor: FeedActor | null;
  projectSlug: string;
  projectTitle: string;
  verb: string;
  title: string;
  detail?: string;
  href: string;
}

export interface FeedPage {
  items: FeedItem[];
  // Epoch ms of the oldest item; pass back as `before` to fetch the next page.
  // null when there is nothing older.
  nextCursor: number | null;
}

const PAGE_SIZE = 25;

const actorSelect = {
  displayName: true,
  githubLogin: true,
  avatarUrl: true,
} as const;

const projectSelect = { slug: true, title: true } as const;

function truncate(text: string, max = 140): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/**
 * Aggregate a reverse-chronological activity feed for `userId` across the
 * source tables, scoped to:
 *   - projects the user follows or belongs to,
 *   - projects that people the user follows created or joined,
 *   - activity authored by people the user follows.
 * Reads live (no dedicated activity table) and merges in code.
 */
async function computeActivityFeed(userId: string, before: number | null): Promise<FeedPage> {
  // Cursor: only items strictly... actually `lte` so ties on the boundary
  // timestamp aren't skipped — the client dedupes the repeated boundary item.
  const olderThan = before != null ? { lte: new Date(before) } : undefined;

  const [followedProjects, memberships, follows] = await Promise.all([
    prisma.projectFollow.findMany({ where: { userId }, select: { projectId: true } }),
    prisma.membership.findMany({ where: { userId, leftAt: null }, select: { projectId: true } }),
    prisma.userFollow.findMany({ where: { followerId: userId }, select: { followingId: true } }),
  ]);

  const followedUserIds = follows.map((f) => f.followingId);

  // Projects the people you follow created or joined (owners hold an `owner`
  // membership, so memberships cover both).
  const followedUserProjects = followedUserIds.length
    ? await prisma.membership.findMany({
        where: { userId: { in: followedUserIds }, leftAt: null },
        select: { projectId: true },
      })
    : [];

  const projectIds = [
    ...new Set([
      ...followedProjects.map((f) => f.projectId),
      ...memberships.map((m) => m.projectId),
      ...followedUserProjects.map((m) => m.projectId),
    ]),
  ];

  // Nothing to show — skip the source queries entirely.
  if (projectIds.length === 0 && followedUserIds.length === 0) {
    return { items: [], nextCursor: null };
  }

  // Each source is filtered/ordered by the same timestamp it contributes as the
  // feed's sort key (`at`), so the cursor is consistent across the merge.
  const [announcements, events, messages, tasks] = await Promise.all([
    prisma.announcement.findMany({
      where: {
        moderationStatus: "published",
        createdAt: olderThan,
        OR: [{ projectId: { in: projectIds } }, { authorId: { in: followedUserIds } }],
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      include: { author: { select: actorSelect }, project: { select: projectSelect } },
    }),
    prisma.event.findMany({
      where: {
        createdAt: olderThan,
        OR: [{ projectId: { in: projectIds } }, { createdById: { in: followedUserIds } }],
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      include: { createdBy: { select: actorSelect }, project: { select: projectSelect } },
    }),
    prisma.message.findMany({
      where: {
        deletedAt: null,
        createdAt: olderThan,
        OR: [{ projectId: { in: projectIds } }, { authorId: { in: followedUserIds } }],
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      include: {
        author: { select: actorSelect },
        project: { select: projectSelect },
        parent: { select: { id: true, title: true } },
      },
    }),
    prisma.task.findMany({
      where: {
        updatedAt: olderThan,
        OR: [
          { projectId: { in: projectIds } },
          { createdById: { in: followedUserIds } },
          { assigneeId: { in: followedUserIds } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: PAGE_SIZE,
      include: {
        createdBy: { select: actorSelect },
        assignee: { select: actorSelect },
        project: { select: projectSelect },
      },
    }),
  ]);

  const items: FeedItem[] = [];

  for (const a of announcements) {
    items.push({
      id: `ann_${a.id}`,
      type: "announcement",
      at: a.createdAt.getTime(),
      actor: a.author,
      projectSlug: a.project.slug,
      projectTitle: a.project.title,
      verb: "posted an announcement in",
      title: a.title,
      detail: a.summary ?? undefined,
      href: `/p/${a.project.slug}/announcements/${a.id}`,
    });
  }

  for (const e of events) {
    items.push({
      id: `evt_${e.id}`,
      type: "event",
      at: e.createdAt.getTime(),
      actor: e.createdBy,
      projectSlug: e.project.slug,
      projectTitle: e.project.title,
      verb: "scheduled an event in",
      title: e.title,
      detail: e.startAt.toLocaleString([], {
        weekday: "short",
        month: "short",
        day: "numeric",
        ...(e.allDay ? {} : { hour: "2-digit", minute: "2-digit" }),
      }),
      href: `/p/${e.project.slug}/calendar`,
    });
  }

  for (const m of messages) {
    const isReply = m.parentId != null;
    items.push({
      id: `msg_${m.id}`,
      type: isReply ? "reply" : "thread",
      at: m.createdAt.getTime(),
      actor: m.author,
      projectSlug: m.project.slug,
      projectTitle: m.project.title,
      verb: isReply ? "replied in" : "started a discussion in",
      title: (isReply ? m.parent?.title : m.title) ?? "a thread",
      detail: isReply ? truncate(m.body) : undefined,
      href: `/p/${m.project.slug}/discussion/${isReply ? m.parentId : m.id}`,
    });
  }

  for (const t of tasks) {
    // No per-field history — treat a task whose updatedAt is essentially its
    // createdAt as freshly created, otherwise as an update.
    const created = t.updatedAt.getTime() - t.createdAt.getTime() < 1_000;
    items.push({
      id: `task_${t.id}`,
      type: "task",
      at: t.updatedAt.getTime(),
      actor: t.createdBy ?? t.assignee,
      projectSlug: t.project.slug,
      projectTitle: t.project.title,
      verb: created ? "created a task in" : "updated a task in",
      title: t.title,
      detail: created ? undefined : `now ${t.status}`,
      href: `/p/${t.project.slug}/tasks`,
    });
  }

  const sorted = items.sort((x, y) => y.at - x.at);
  const page = sorted.slice(0, PAGE_SIZE);

  // More history exists if the merge overflowed a page, or any single source
  // returned a full page (it may have more below this window).
  const anySourceFull = [announcements, events, messages, tasks].some(
    (s) => s.length >= PAGE_SIZE,
  );
  const hasMore = sorted.length > PAGE_SIZE || anySourceFull;
  const nextCursor = hasMore && page.length > 0 ? page[page.length - 1].at : null;

  return { items: page, nextCursor };
}

/**
 * Cached entry point. The feed is moderately expensive (several queries merged
 * in code) and tolerates brief staleness, so we cache per (user, cursor) for a
 * short window. Returns plain JSON-safe data (`at` is epoch ms), which is why
 * the cache round-trip is lossless.
 */
export function getActivityFeed(userId: string, before: number | null = null): Promise<FeedPage> {
  return unstable_cache(
    () => computeActivityFeed(userId, before),
    ["activity-feed", userId, String(before ?? "first")],
    { revalidate: 60, tags: [`activity:${userId}`] },
  )();
}
