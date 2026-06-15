import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const CHAT_ENABLED = process.env.CHAT_ENABLED === "true";

async function getProject(slug: string) {
  return prisma.project.findUnique({ where: { slug }, select: { id: true } });
}

async function getMembership(projectId: string, userId: string) {
  return prisma.membership.findUnique({
    where: { projectId_userId: { projectId, userId }, leftAt: null },
    select: { id: true },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  if (!CHAT_ENABLED) return NextResponse.json({ error: "Chat disabled" }, { status: 404 });

  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const membership = await getMembership(project.id, session.user.id);
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const since = req.nextUrl.searchParams.get("since");

  const messages = await prisma.chatMessage.findMany({
    where: {
      projectId: project.id,
      ...(since ? { createdAt: { gt: new Date(since) } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: since ? 100 : 60,
    include: {
      user: { select: { id: true, githubLogin: true, displayName: true, avatarUrl: true } },
    },
  });

  const onlineThreshold = new Date(Date.now() - 2 * 60 * 1000);
  const members = await prisma.membership.findMany({
    where: { projectId: project.id, leftAt: null },
    select: {
      presenceAt: true,
      user: { select: { id: true, githubLogin: true, displayName: true, avatarUrl: true } },
    },
  });

  return NextResponse.json({
    messages,
    members: members.map((m) => ({
      ...m.user,
      online: m.presenceAt != null && m.presenceAt > onlineThreshold,
    })),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  if (!CHAT_ENABLED) return NextResponse.json({ error: "Chat disabled" }, { status: 404 });

  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const membership = await getMembership(project.id, session.user.id);
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { body } = await req.json();
  if (!body || typeof body !== "string" || body.trim().length === 0) {
    return NextResponse.json({ error: "Body required" }, { status: 422 });
  }
  if (body.length > 2000) {
    return NextResponse.json({ error: "Message too long" }, { status: 422 });
  }

  const msg = await prisma.chatMessage.create({
    data: { projectId: project.id, userId: session.user.id, body: body.trim() },
    include: {
      user: { select: { id: true, githubLogin: true, displayName: true, avatarUrl: true } },
    },
  });

  return NextResponse.json(msg, { status: 201 });
}
