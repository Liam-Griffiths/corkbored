import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Markdown } from "@/components/Markdown";
import { ShareButtons } from "@/components/ShareButtons";

const KIND_LABELS: Record<string, string> = {
  update: "Update", release: "Release", roles_open: "Roles open", milestone: "Milestone",
};

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
      author: { select: { displayName: true, githubLogin: true } },
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://corkbored.com";
  const shareUrl = `${appUrl}/p/${slug}/announcements/${id}`;

  return (
    <article className="mx-auto max-w-2xl">
      <Link href={`/p/${slug}/announcements`} className="mb-4 inline-block font-mono text-xs text-ink-soft hover:text-ink">
        ‹ all announcements
      </Link>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-paper-edge px-2 py-0.5 font-mono text-[0.6rem] text-ink-soft">
          {KIND_LABELS[announcement.kind] ?? announcement.kind}
        </span>
        {!isPublic && (
          <span className="rounded-full bg-[#fff8e1] px-2 py-0.5 font-mono text-[0.6rem] text-pin-gold">
            {announcement.publishedAt ? "held" : "draft"}
          </span>
        )}
      </div>

      <h1 className="font-display text-2xl font-bold leading-tight text-ink">{announcement.title}</h1>
      <p className="mt-1.5 font-mono text-xs text-ink-soft">
        {announcement.author?.displayName ?? announcement.author?.githubLogin}
        {announcement.publishedAt &&
          ` · ${new Date(announcement.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`}
      </p>

      <div className="my-5 border-y border-paper-edge py-5">
        <Markdown>{announcement.body}</Markdown>
      </div>

      {/* Share */}
      <div className="mb-6">
        <ShareButtons shortUrl={shareUrl} title={announcement.title} />
      </div>

      {/* Project card */}
      <Link
        href={`/p/${slug}`}
        className="block rounded-lg border border-paper-edge bg-paper p-4 transition-colors hover:border-ink-soft"
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
