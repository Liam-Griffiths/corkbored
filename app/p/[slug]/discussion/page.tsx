import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { DiscussionThread } from "@/components/DiscussionThread";

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

  const messages = await prisma.message.findMany({
    where: { projectId: project.id, parentId: null, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { id: true, displayName: true, githubLogin: true } },
      replies: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, displayName: true, githubLogin: true } } },
      },
    },
  });

  return (
    <div className="max-w-2xl px-8 py-8">
      <h1 className="font-display font-bold text-xl text-ink mb-6">Discussion</h1>
      <DiscussionThread
        initialMessages={messages as Parameters<typeof DiscussionThread>[0]["initialMessages"]}
        currentUserId={session.user.id}
        projectSlug={slug}
      />
    </div>
  );
}
