import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, AuthError } from "@/lib/authz";
import { PatchTaskSchema } from "@/lib/validators";
import { apiError } from "@/lib/api";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await requireUser();

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        project: {
          include: { memberships: { where: { leftAt: null } } },
        },
      },
    });
    if (!task) return Response.json({ error: "Not found" }, { status: 404 });

    const isMember = task.project.memberships.some((m) => m.userId === user.id);
    if (!isMember) throw new AuthError(403, "Members only");

    const body = PatchTaskSchema.parse(await req.json());

    // Validate assignee is an active member
    if (body.assigneeId !== undefined && body.assigneeId !== null) {
      const assigneeMember = task.project.memberships.find(
        (m) => m.userId === body.assigneeId,
      );
      if (!assigneeMember) {
        return Response.json(
          { error: "Assignee must be an active project member" },
          { status: 422 },
        );
      }
    }

    const prevStatus = task.status;
    const newStatus = body.status ?? prevStatus;

    const updated = await prisma.$transaction(async (tx) => {
      const t = await tx.task.update({
        where: { id },
        data: {
          title: body.title,
          description: body.description,
          status: body.status,
          assigneeId: body.assigneeId,
          position: body.position,
          tags: body.tags,
        },
        include: {
          assignee: { select: { id: true, displayName: true, githubLogin: true } },
          createdBy: { select: { id: true, displayName: true, githubLogin: true } },
        },
      });

      // Create ContributionEvent when a task moves to done with an assignee
      if (newStatus === "done" && prevStatus !== "done" && t.assigneeId) {
        await tx.contributionEvent.upsert({
          where: {
            projectId_kind_externalId: {
              projectId: task.projectId,
              kind: "manual",
              externalId: id,
            },
          },
          update: {},
          create: {
            projectId: task.projectId,
            userId: t.assigneeId,
            kind: "manual",
            externalId: id,
            metadata: { taskTitle: t.title },
          },
        });
      }

      return t;
    });

    return Response.json(updated);
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await requireUser();

    const task = await prisma.task.findUnique({
      where: { id },
      include: { project: { include: { memberships: { where: { leftAt: null } } } } },
    });
    if (!task) return Response.json({ error: "Not found" }, { status: 404 });

    const isMember = task.project.memberships.some((m) => m.userId === user.id);
    if (!isMember) throw new AuthError(403, "Members only");

    await prisma.task.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (e) {
    return apiError(e);
  }
}
