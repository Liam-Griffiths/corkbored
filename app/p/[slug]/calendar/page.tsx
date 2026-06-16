import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { CalendarBoard } from "@/components/CalendarBoard";

export default async function CalendarPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();

  if (!session?.user?.id) redirect(`/api/auth/signin?callbackUrl=/p/${slug}/calendar`);

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

  return (
    <div>
      <h1 className="mb-6 font-display text-xl font-bold text-ink">Calendar</h1>
      <CalendarBoard slug={slug} />
    </div>
  );
}
