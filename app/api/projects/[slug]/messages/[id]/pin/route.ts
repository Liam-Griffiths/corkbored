import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireProjectMember, AuthError } from "@/lib/authz";
import { apiError } from "@/lib/api";

// Toggle a thread's pinned state. Owners/maintainers only; thread roots only.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  try {
    const { slug, id } = await params;
    const message = await prisma.message.findUnique({
      where: { id },
      select: { id: true, parentId: true, pinnedAt: true, deletedAt: true, project: { select: { id: true, slug: true } } },
    });
    if (!message || message.project.slug !== slug || message.deletedAt) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    if (message.parentId !== null) {
      return Response.json({ error: "Only threads can be pinned" }, { status: 422 });
    }
    const user = await requireProjectMember(message.project.id);

    const membership = await prisma.membership.findUnique({
      where: { projectId_userId: { projectId: message.project.id, userId: user.id } },
      select: { role: true },
    });
    if (membership?.role !== "owner" && membership?.role !== "maintainer") {
      throw new AuthError(403, "Only owners or maintainers can pin threads");
    }

    const pinnedAt = message.pinnedAt ? null : new Date();
    await prisma.message.update({ where: { id }, data: { pinnedAt } });
    return Response.json({ pinnedAt });
  } catch (e) {
    return apiError(e);
  }
}
