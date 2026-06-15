import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const CHAT_ENABLED = process.env.CHAT_ENABLED === "true";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  if (!CHAT_ENABLED) return NextResponse.json({ ok: false });

  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const project = await prisma.project.findUnique({ where: { slug }, select: { id: true } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.membership.updateMany({
    where: { projectId: project.id, userId: session.user.id, leftAt: null },
    data: { presenceAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
