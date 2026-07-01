import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Markdown } from "@/components/Markdown";
import { ShareButtons } from "@/components/ShareButtons";
import { summaryOf } from "@/lib/text";
import { absoluteUrl } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}): Promise<Metadata> {
  const { slug, id } = await params;
  const announcement = await prisma.announcement.findUnique({
    where: { id },
    select: {
      title: true,
      summary: true,
      body: true,
      moderationStatus: true,
      publishedAt: true,
      project: { select: { slug: true, title: true, moderationStatus: true } },
    },
  });

  const isPublic =
    announcement &&
    announcement.project.slug === slug &&
    announcement.moderationStatus === "published" &&
    announcement.publishedAt != null &&
    announcement.project.moderationStatus === "published";

  if (!isPublic) {
    return { title: "Announcement", robots: { index: false } };
  }

  const description = summaryOf(announcement);
  const canonical = absoluteUrl(`/p/${slug}/announcements/${id}`);

  return {
    title: `${announcement.title} · ${announcement.project.title}`,
    description,
    alternates: { canonical },
    openGraph: {
      title: announcement.title,
      description,
      url: canonical,
      type: "article",
      publishedTime: announcement.publishedAt?.toISOString(),
    },
  };
}

// Per-kind theming — a coloured chip + matching push-pin, so each kind of
// announcement reads at a glance and ties into the corkboard look.
const KIND_THEME: Record<string, { label: string; chip: string; pin: string }> = {
  update: { label: "Update", chip: "bg-paper-edge text-ink-soft", pin: "bg-ink/50" },
  release: { label: "Release", chip: "bg-pin-gold/15 text-pin-gold", pin: "bg-pin-gold" },
  roles_open: { label: "Roles open", chip: "bg-pin-red/12 text-pin-red", pin: "bg-pin-red" },
  milestone: { label: "Milestone", chip: "bg-pin-teal/12 text-pin-teal", pin: "bg-pin-teal" },
};

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function readingTime(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export default async function AnnouncementPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const session = await auth();

  const announcement = await prisma.announcement.findUnique({
    where: { id },
    include: {
      author: { select: { displayName: true, githubLogin: true, avatarUrl: true } },
      project: { select: { id: true, slug: true, title: true, repoFullName: true, pitch: true, moderationStatus: true } },
    },
  });
  if (!announcement || announcement.project.slug !== slug) notFound();
  if (announcement.project.moderationStatus === "removed" || announcement.moderationStatus === "removed") notFound();

  const isPublic = announcement.moderationStatus === "published" && announcement.publishedAt != null;
  if (!isPublic) {
    // Drafts and held announcements are visible only to owners/maintainers.
    const membership = session?.user?.id
      ? await prisma.membership.findUnique({
          where: { projectId_userId: { projectId: announcement.project.id, userId: session.user.id } },
          select: { role: true, leftAt: true },
        })
      : null;
    const isManager = !!membership && !membership.leftAt && ["owner", "maintainer"].includes(membership.role as string);
    if (!isManager) notFound();
  }

  // Other published announcements from the same project, to keep readers going.
  const more = await prisma.announcement.findMany({
    where: {
      projectId: announcement.project.id,
      moderationStatus: "published",
      publishedAt: { not: null },
      id: { not: announcement.id },
    },
    orderBy: { publishedAt: "desc" },
    take: 3,
    select: { id: true, title: true, kind: true, publishedAt: true },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://corkbored.com";
  const shareUrl = `${appUrl}/p/${slug}/announcements/${id}`;
  const theme = KIND_THEME[announcement.kind] ?? KIND_THEME.update;
  const authorName = announcement.author?.displayName ?? announcement.author?.githubLogin ?? "Unknown";

  return (
    <article className="mx-auto max-w-4xl">
      <Link href={`/p/${slug}/announcements`} className="mb-5 inline-block font-mono text-xs text-ink-soft hover:text-ink">
        ‹ all announcements
      </Link>

      {/* Header */}
      <header>
        <div className="mb-2.5 flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 font-mono text-[0.62rem] uppercase tracking-wide ${theme.chip}`}>
            {theme.label}
          </span>
          {!isPublic && (
            <span className="rounded-full bg-[#fff8e1] px-2 py-0.5 font-mono text-[0.6rem] text-pin-gold">
              {announcement.publishedAt ? "held" : "draft"}
            </span>
          )}
        </div>

        <h1 className="font-display text-3xl font-extrabold leading-[1.15] tracking-tight text-ink">
          {announcement.title}
        </h1>

        <div className="mt-4 flex items-center gap-2.5">
          {announcement.author?.avatarUrl ? (
            <Image
              src={announcement.author.avatarUrl}
              alt={authorName}
              width={36}
              height={36}
              className="h-9 w-9 rounded-full"
            />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-pin-teal text-sm font-bold text-white">
              {authorName[0]?.toUpperCase() ?? "?"}
            </span>
          )}
          <div className="leading-tight">
            <p className="text-sm font-medium text-ink">{authorName}</p>
            <p className="font-mono text-xs text-ink-soft">
              {announcement.publishedAt ? fmtDate(announcement.publishedAt) : "Unpublished draft"}
              {" · "}
              {readingTime(announcement.body)} min read
            </p>
          </div>
        </div>
      </header>

      {/* Body — pinned paper note */}
      <div className="relative mt-7">
        <span
          className={`pushpin absolute -top-2.5 left-1/2 z-10 h-4 w-4 -translate-x-1/2 rounded-full ${theme.pin}`}
          aria-hidden="true"
        />
        <div className="rounded-sm border border-paper-edge bg-paper px-6 py-7 shadow-[0_4px_14px_rgba(0,0,0,.08)] sm:px-8">
          <Markdown>{announcement.body}</Markdown>
        </div>
      </div>

      {/* Share */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <span className="font-mono text-[0.62rem] uppercase tracking-widest text-ink-soft">Share this update</span>
        <ShareButtons shortUrl={shareUrl} title={announcement.title} />
      </div>

      {/* More from this project */}
      {more.length > 0 && (
        <section className="mt-8 border-t border-paper-edge pt-6">
          <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-ink-soft">
            More from {announcement.project.title}
          </h2>
          <ul className="space-y-2">
            {more.map((a) => {
              const t = KIND_THEME[a.kind] ?? KIND_THEME.update;
              return (
                <li key={a.id}>
                  <Link
                    href={`/p/${slug}/announcements/${a.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-paper-edge bg-paper px-4 py-3 transition-colors hover:border-ink-soft"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className={`h-2 w-2 flex-shrink-0 rounded-full ${t.pin}`} aria-hidden="true" />
                      <span className="truncate text-sm font-medium text-ink">{a.title}</span>
                    </div>
                    {a.publishedAt && (
                      <span className="flex-shrink-0 font-mono text-[0.65rem] text-ink-soft">{fmtDate(a.publishedAt)}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Project card */}
      <Link
        href={`/p/${slug}`}
        className="mt-6 block rounded-lg border border-paper-edge bg-paper p-4 transition-colors hover:border-ink-soft"
      >
        <p className="font-mono text-[0.62rem] uppercase tracking-widest text-ink-soft">From the project</p>
        <p className="mt-1 font-display text-base font-semibold text-ink">{announcement.project.title}</p>
        <p className="font-mono text-xs text-ink-soft">github.com/{announcement.project.repoFullName}</p>
        {announcement.project.pitch && (
          <p className="mt-1.5 line-clamp-2 text-sm text-ink/75">{announcement.project.pitch}</p>
        )}
        <span className="mt-2 inline-block font-mono text-xs text-pin-teal">View project →</span>
      </Link>
    </article>
  );
}
