import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, AuthError } from "@/lib/authz";
import { CreateMessageSchema } from "@/lib/validators";
import { apiError } from "@/lib/api";

export async function GET(
  _req: NextRequest,
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

    const roots = await prisma.message.findMany({
      where: { projectId: project.id, parentId: null, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { id: true, displayName: true, githubLogin: true } },
        replies: {
          where: { deletedAt: null },
          orderBy: { createdAt: "asc" },
          include: {
            author: { select: { id: true, displayName: true, githubLogin: true } },
          },
        },
      },
    });

    return Response.json(roots);
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const user = await requireUser();

    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        memberships: { where: { leftAt: null } },
      },
    });
    if (!project) return Response.json({ error: "Not found" }, { status: 404 });

    const myMembership = project.memberships.find((m) => m.userId === user.id);
    if (!myMembership) throw new AuthError(403, "Members only");

    // Rate limit: 60 messages per user per project per day
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await prisma.message.count({
      where: { projectId: project.id, authorId: user.id, createdAt: { gte: today } },
    });
    if (todayCount >= 60) {
      return Response.json({ error: "Message limit reached (60/day per project)" }, { status: 429 });
    }

    const body = CreateMessageSchema.parse(await req.json());

    // Root threads need a title; replies must not carry one.
    if (!body.parentId && !body.title?.trim()) {
      return Response.json({ error: "Thread title required" }, { status: 422 });
    }

    // Enforce one level of threading: parentId must reference a root message
    if (body.parentId) {
      const parent = await prisma.message.findUnique({
        where: { id: body.parentId },
        select: { parentId: true, projectId: true },
      });
      if (!parent || parent.projectId !== project.id) {
        return Response.json({ error: "Parent message not found" }, { status: 404 });
      }
      if (parent.parentId !== null) {
        return Response.json(
          { error: "Cannot reply to a reply — one level of threading only" },
          { status: 422 },
        );
      }
    }

    const message = await prisma.message.create({
      data: {
        projectId: project.id,
        authorId: user.id,
        title: body.parentId ? null : body.title!.trim(),
        body: body.body,
        parentId: body.parentId ?? null,
      },
      include: {
        author: { select: { id: true, displayName: true, githubLogin: true } },
      },
    });

    // Notify members on new root threads (not replies)
    if (!body.parentId) {
      const otherMembers = project.memberships.filter((m) => m.userId !== user.id);
      if (otherMembers.length > 0) {
        await prisma.notification.createMany({
          data: otherMembers.map((m) => ({
            userId: m.userId,
            kind: "new_thread" as const,
            projectId: project.id,
          })),
        });
      }
    }

    return Response.json(message, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
