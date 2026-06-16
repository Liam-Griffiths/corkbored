import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { ThreadView } from "@/components/ThreadView";

const authorSelect = { id: true, displayName: true, githubLogin: true };

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ slug: string; threadId: string }>;
}) {
  const { slug, threadId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/api/auth/signin?callbackUrl=/p/${slug}/discussion/${threadId}`);

  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true, moderationStatus: true },
  });
  if (!project || project.moderationStatus === "removed") notFound();

  const membership = await prisma.membership.findUnique({
    where: { projectId_userId: { projectId: project.id, userId: session.user.id } },
    select: { role: true, leftAt: true },
  });
  if (!membership || membership.leftAt) redirect(`/p/${slug}`);
  const isManager = membership.role === "owner" || membership.role === "maintainer";

  const thread = await prisma.message.findFirst({
    where: { id: threadId, projectId: project.id, parentId: null, deletedAt: null },
    include: {
      author: { select: authorSelect },
      _count: { select: { votes: true } },
      replies: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: authorSelect },
          _count: { select: { votes: true } },
        },
      },
    },
  });
  if (!thread) notFound();

  // Which of these posts the current user has upvoted.
  const ids = [thread.id, ...thread.replies.map((r) => r.id)];
  const myVotes = await prisma.postVote.findMany({
    where: { userId: session.user.id, messageId: { in: ids } },
    select: { messageId: true },
  });
  const votedIds = myVotes.map((v) => v.messageId);

  const toPost = (m: typeof thread | (typeof thread.replies)[number]) => ({
    id: m.id,
    title: "title" in m ? m.title : null,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    editedAt: m.editedAt ? m.editedAt.toISOString() : null,
    pinnedAt: "pinnedAt" in m && m.pinnedAt ? m.pinnedAt.toISOString() : null,
    author: m.author,
    voteCount: m._count.votes,
    voted: votedIds.includes(m.id),
  });

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/p/${slug}/discussion`} className="mb-4 inline-block font-mono text-xs text-ink-soft hover:text-ink">
        ‹ all threads
      </Link>
      <ThreadView
        slug={slug}
        currentUserId={session.user.id}
        isManager={isManager}
        thread={toPost(thread)}
        initialReplies={thread.replies.map(toPost)}
      />
    </div>
  );
}
