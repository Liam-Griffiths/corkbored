import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NewThreadForm } from "@/components/NewThreadForm";

function authorName(a: { displayName: string | null; githubLogin: string | null }) {
  return a.displayName ?? a.githubLogin ?? "Someone";
}

export default async function DiscussionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/api/auth/signin?callbackUrl=/p/${slug}/discussion`);

  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true, moderationStatus: true },
  });
  if (!project || project.moderationStatus === "removed") notFound();

  const membership = await prisma.membership.findUnique({
    where: { projectId_userId: { projectId: project.id, userId: session.user.id } },
    select: { leftAt: true },
  });
  if (!membership || membership.leftAt) redirect(`/p/${slug}`);

  const roots = await prisma.message.findMany({
    where: { projectId: project.id, parentId: null, deletedAt: null },
    include: {
      author: { select: { id: true, displayName: true, githubLogin: true } },
      _count: { select: { votes: true } },
    },
  });

  // Reply count + latest reply time per thread (excluding soft-deleted replies).
  const replyStats = roots.length
    ? await prisma.message.groupBy({
        by: ["parentId"],
        where: { parentId: { in: roots.map((r) => r.id) }, deletedAt: null },
        _count: { _all: true },
        _max: { createdAt: true },
      })
    : [];
  const statById = new Map(replyStats.map((s) => [s.parentId, s]));

  const threads = roots
    .map((r) => {
      const stat = statById.get(r.id);
      const lastAt = stat?._max.createdAt ?? r.createdAt;
      return { ...r, replyCount: stat?._count._all ?? 0, lastAt };
    })
    .sort((a, b) => {
      if (!!a.pinnedAt !== !!b.pinnedAt) return a.pinnedAt ? -1 : 1;
      return b.lastAt.getTime() - a.lastAt.getTime();
    });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 font-display text-xl font-bold text-ink">Discussion</h1>

      <NewThreadForm slug={slug} />

      {threads.length === 0 ? (
        <p className="rounded-lg border border-dashed border-paper-edge p-8 text-center font-mono text-sm text-ink-soft">
          No threads yet. Start the conversation.
        </p>
      ) : (
        <ul className="divide-y divide-paper-edge rounded-lg border border-paper-edge bg-paper">
          {threads.map((t) => (
            <li key={t.id}>
              <Link href={`/p/${slug}/discussion/${t.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-paper-bright">
                <div className="flex w-9 flex-shrink-0 flex-col items-center font-mono text-ink-soft">
                  <span className="text-sm leading-none text-ink">▲</span>
                  <span className="text-xs">{t._count.votes}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {t.pinnedAt && (
                      <span className="rounded-sm bg-pin-gold/25 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-wide text-ink">
                        📌 pinned
                      </span>
                    )}
                    <span className="truncate font-display text-sm font-semibold text-ink">{t.title}</span>
                  </div>
                  <p className="mt-0.5 font-mono text-[0.7rem] text-ink-soft">
                    {authorName(t.author)} · {t.replyCount} {t.replyCount === 1 ? "reply" : "replies"} ·{" "}
                    last activity {t.lastAt.toLocaleDateString()}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
