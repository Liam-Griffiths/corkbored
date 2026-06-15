import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/authz";
import { apiError } from "@/lib/api";

async function getTarget(login: string) {
  return prisma.user.findUnique({
    where: { githubLogin: login },
    select: { id: true },
  });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ login: string }> },
) {
  try {
    const { login } = await params;
    const user = await requireUser();
    const target = await getTarget(login);
    if (!target) return Response.json({ error: "Not found" }, { status: 404 });
    if (target.id === user.id) return Response.json({ error: "Cannot follow yourself" }, { status: 400 });

    const existing = await prisma.userFollow.findUnique({
      where: { followerId_followingId: { followerId: user.id, followingId: target.id } },
    });

    if (!existing) {
      await prisma.userFollow.create({ data: { followerId: user.id, followingId: target.id } });
      await prisma.notification.create({ data: { userId: target.id, kind: "new_follower" } });
    }

    const count = await prisma.userFollow.count({ where: { followingId: target.id } });
    return Response.json({ following: true, count });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ login: string }> },
) {
  try {
    const { login } = await params;
    const user = await requireUser();
    const target = await getTarget(login);
    if (!target) return Response.json({ error: "Not found" }, { status: 404 });

    await prisma.userFollow.deleteMany({
      where: { followerId: user.id, followingId: target.id },
    });

    const count = await prisma.userFollow.count({ where: { followingId: target.id } });
    return Response.json({ following: false, count });
  } catch (e) {
    return apiError(e);
  }
}
