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

    const invite = await prisma.projectInvite.findUnique({
      where: { id },
      select: { id: true, projectId: true, status: true },
    });
    if (!invite) return Response.json({ error: "Not found" }, { status: 404 });

    const membership = await prisma.membership.findUnique({
      where: { projectId_userId: { projectId: invite.projectId, userId: user.id } },
      select: { role: true, leftAt: true },
    });
    if (!membership || membership.leftAt || membership.role === "member") {
      throw new AuthError(403, "Project manager access required");
    }

    if (invite.status === "accepted") {
      return Response.json(
        { error: "That invite was already accepted" },
        { status: 409 },
      );
    }

    await prisma.projectInvite.update({
      where: { id },
      data: { status: "revoked" },
    });

    return new Response(null, { status: 204 });
  } catch (e) {
    return apiError(e);
  }
}
