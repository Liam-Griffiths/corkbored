import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireProjectMember } from "@/lib/authz";
import { apiError } from "@/lib/api";

// Toggle the current member's upvote on a post; returns the new count + state.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  try {
    const { slug, id } = await params;
    const message = await prisma.message.findUnique({
      where: { id },
      select: { id: true, deletedAt: true, project: { select: { id: true, slug: true } } },
    });
    if (!message || message.project.slug !== slug || message.deletedAt) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    const user = await requireProjectMember(message.project.id);

    const existing = await prisma.postVote.findUnique({
      where: { messageId_userId: { messageId: id, userId: user.id } },
    });
    if (existing) {
      await prisma.postVote.delete({ where: { messageId_userId: { messageId: id, userId: user.id } } });
    } else {
      await prisma.postVote.create({ data: { messageId: id, userId: user.id } });
    }

    const count = await prisma.postVote.count({ where: { messageId: id } });
    return Response.json({ count, voted: !existing });
  } catch (e) {
    return apiError(e);
  }
}
