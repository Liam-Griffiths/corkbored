import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, AuthError } from "@/lib/authz";
import { apiError } from "@/lib/api";

async function getProject(slug: string) {
  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true, moderationStatus: true },
  });
  if (!project || project.moderationStatus === "removed") return null;
  return project;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const user = await requireUser();
    const project = await getProject(slug);
    if (!project) return Response.json({ error: "Not found" }, { status: 404 });

    await prisma.projectFollow.upsert({
      where: { userId_projectId: { userId: user.id, projectId: project.id } },
      create: { userId: user.id, projectId: project.id },
      update: {},
    });

    const count = await prisma.projectFollow.count({ where: { projectId: project.id } });
    return Response.json({ following: true, count });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const user = await requireUser();
    const project = await getProject(slug);
    if (!project) return Response.json({ error: "Not found" }, { status: 404 });

    await prisma.projectFollow.deleteMany({
      where: { userId: user.id, projectId: project.id },
    });

    const count = await prisma.projectFollow.count({ where: { projectId: project.id } });
    return Response.json({ following: false, count });
  } catch (e) {
    if (e instanceof AuthError) return apiError(e);
    return apiError(e);
  }
}
