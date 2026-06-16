import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireProjectMember, AuthError } from "@/lib/authz";
import { PatchMessageSchema } from "@/lib/validators";
import { apiError } from "@/lib/api";

const authorSelect = { id: true, displayName: true, githubLogin: true };

async function loadMessage(slug: string, id: string) {
  const message = await prisma.message.findUnique({
    where: { id },
    select: {
      id: true,
      authorId: true,
      parentId: true,
      deletedAt: true,
      project: { select: { id: true, slug: true } },
    },
  });
  if (!message || message.project.slug !== slug || message.deletedAt) return null;
  return message;
}

async function memberRole(projectId: string, userId: string) {
  const m = await prisma.membership.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { role: true, leftAt: true },
  });
  return m && !m.leftAt ? m.role : null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  try {
    const { slug, id } = await params;
    const message = await loadMessage(slug, id);
    if (!message) return Response.json({ error: "Not found" }, { status: 404 });
    const user = await requireProjectMember(message.project.id);
    if (message.authorId !== user.id) throw new AuthError(403, "You can only edit your own posts");

    const body = PatchMessageSchema.parse(await req.json());

    const updated = await prisma.message.update({
      where: { id },
      data: {
        ...(body.body !== undefined ? { body: body.body } : {}),
        // Titles only apply to thread roots.
        ...(body.title !== undefined && message.parentId === null ? { title: body.title } : {}),
        editedAt: new Date(),
      },
      include: { author: { select: authorSelect } },
    });

    return Response.json(updated);
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  try {
    const { slug, id } = await params;
    const message = await loadMessage(slug, id);
    if (!message) return Response.json({ error: "Not found" }, { status: 404 });
    const user = await requireProjectMember(message.project.id);

    // Author can delete their own; owners/maintainers can delete anyone's.
    const role = await memberRole(message.project.id, user.id);
    const isManager = role === "owner" || role === "maintainer";
    if (message.authorId !== user.id && !isManager) {
      throw new AuthError(403, "You can't delete this post");
    }

    await prisma.message.update({ where: { id }, data: { deletedAt: new Date() } });
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
