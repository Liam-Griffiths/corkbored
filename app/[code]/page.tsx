import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";

interface Props {
  params: Promise<{ code: string }>;
}

export default async function ShortLinkPage({ params }: Props) {
  const { code } = await params;

  const link = await prisma.shortLink.findUnique({ where: { code } });
  if (!link) notFound();

  if (link.target === "project" && link.projectId) {
    const project = await prisma.project.findUnique({
      where: { id: link.projectId },
      select: { slug: true, moderationStatus: true },
    });
    if (!project || project.moderationStatus === "removed") notFound();
    redirect(`/p/${project.slug}`);
  }

  if (link.target === "user" && link.userId) {
    const user = await prisma.user.findUnique({
      where: { id: link.userId },
      select: { githubLogin: true },
    });
    if (!user?.githubLogin) notFound();
    redirect(`/u/${user.githubLogin}`);
  }

  notFound();
}
