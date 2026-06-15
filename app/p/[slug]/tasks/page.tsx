import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { KanbanBoard } from "@/components/KanbanBoard";

export default async function TasksPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();

  if (!session?.user?.id) redirect(`/api/auth/signin?callbackUrl=/p/${slug}/tasks`);

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

  const [tasks, memberships] = await Promise.all([
    prisma.task.findMany({
      where: { projectId: project.id },
      orderBy: { position: "asc" },
      include: {
        assignee: { select: { id: true, displayName: true, githubLogin: true } },
        createdBy: { select: { id: true, displayName: true, githubLogin: true } },
      },
    }),
    prisma.membership.findMany({
      where: { projectId: project.id, leftAt: null },
      include: { user: { select: { id: true, displayName: true, githubLogin: true } } },
    }),
  ]);

  const members = memberships.map((m) => m.user).filter((u): u is NonNullable<typeof u> => u != null);

  return (
    <div>
      <h1 className="font-display font-bold text-xl text-ink mb-6">Tasks</h1>
      <KanbanBoard
        initialTasks={tasks.map((t) => ({
          ...t,
          status: t.status as "backlog" | "todo" | "doing" | "done" | "archived",
          tags: Array.isArray(t.tags) ? (t.tags as string[]) : [],
        }))}
        members={members}
        projectSlug={slug}
      />
    </div>
  );
}
