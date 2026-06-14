import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, AuthError } from "@/lib/authz";
import { apiError } from "@/lib/api";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await requireUser();

    const membership = await prisma.membership.findUnique({
      where: { id },
      include: { project: { include: { memberships: { where: { role: "owner", leftAt: null } } } } },
    });
    if (!membership || membership.leftAt) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const isSelf = membership.userId === user.id;
    const isOwner = membership.project.memberships.some((m) => m.userId === user.id);

    if (!isSelf && !isOwner) {
      throw new AuthError(403, "Cannot remove this member");
    }
    // Owner cannot remove themselves (would leave project with no owner)
    if (isSelf && membership.role === "owner") {
      return Response.json(
        { error: "Owners cannot leave their own project" },
        { status: 422 },
      );
    }

    await prisma.membership.update({
      where: { id },
      data: {
        leftAt: new Date(),
        removedById: isSelf ? null : user.id,
      },
    });

    return new Response(null, { status: 204 });
  } catch (e) {
    return apiError(e);
  }
}
