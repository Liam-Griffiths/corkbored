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
  const before = req.nextUrl.searchParams.get("before");
  const PAGE_SIZE = 50;
  const userSelect = { id: true, githubLogin: true, displayName: true, avatarUrl: true };

  let messages;
  let hasMore = false;

  if (since) {
    // Incremental poll: new messages after the cursor, oldest-first.
    messages = await prisma.chatMessage.findMany({
      where: { projectId: project.id, createdAt: { gt: new Date(since) } },
      orderBy: { createdAt: "asc" },
      take: 100,
      include: { user: { select: userSelect } },
    });
  } else {
    // Initial load or scroll-back: most recent page (optionally before a cursor).
    // Fetch newest-first, take one extra to detect whether older messages exist,
    // then reverse into oldest-first display order.
    const rows = await prisma.chatMessage.findMany({
      where: {
        projectId: project.id,
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE + 1,
      include: { user: { select: userSelect } },
    });
    hasMore = rows.length > PAGE_SIZE;
    messages = rows.slice(0, PAGE_SIZE).reverse();
  }

  const onlineThreshold = new Date(Date.now() - 2 * 60 * 1000);
  const members = await prisma.membership.findMany({
    where: { projectId: project.id, leftAt: null },
    select: {
      presenceAt: true,
      user: { select: userSelect },
    },
  });

  return NextResponse.json({
    messages,
    hasMore,
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
