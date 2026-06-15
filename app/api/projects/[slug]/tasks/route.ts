import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, AuthError } from "@/lib/authz";
import { CreateTaskSchema } from "@/lib/validators";
import { apiError } from "@/lib/api";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const user = await requireUser();

    const project = await prisma.project.findUnique({
      where: { slug },
      include: { memberships: { where: { userId: user.id, leftAt: null } } },
    });
    if (!project) return Response.json({ error: "Not found" }, { status: 404 });
    if (!project.memberships.length) throw new AuthError(403, "Members only");

    const body = CreateTaskSchema.parse(await req.json());
    const status = body.status ?? "todo";

    // Position at the end of the target column
    const last = await prisma.task.findFirst({
      where: { projectId: project.id, status },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const position = (last?.position ?? 0) + 1000;

    const task = await prisma.task.create({
      data: { projectId: project.id, title: body.title, status, position, createdById: user.id },
      include: {
        assignee: { select: { id: true, displayName: true, githubLogin: true } },
        createdBy: { select: { id: true, displayName: true, githubLogin: true } },
      },
    });

    return Response.json(task, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
