import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const CHAT_ENABLED = process.env.CHAT_ENABLED === "true";

const userSelect = { id: true, githubLogin: true, displayName: true, avatarUrl: true };

// Resolves the session user and confirms they authored the message in this project.
async function authorize(slug: string, id: string) {
  if (!CHAT_ENABLED) return { error: NextResponse.json({ error: "Chat disabled" }, { status: 404 }) };

  const session = await auth();
  if (!session?.user?.id) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const message = await prisma.chatMessage.findUnique({
    where: { id },
    select: { id: true, userId: true, project: { select: { slug: true } } },
  });
  if (!message || message.project.slug !== slug) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  if (message.userId !== session.user.id) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { messageId: message.id };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> },
): Promise<NextResponse> {
  const { slug, id } = await params;
  const authz = await authorize(slug, id);
  if (authz.error) return authz.error;

  const { body } = await req.json();
  if (!body || typeof body !== "string" || body.trim().length === 0) {
    return NextResponse.json({ error: "Body required" }, { status: 422 });
  }
  if (body.length > 2000) {
    return NextResponse.json({ error: "Message too long" }, { status: 422 });
  }

  const updated = await prisma.chatMessage.update({
    where: { id: authz.messageId },
    data: { body: body.trim() },
    include: { user: { select: userSelect } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> },
): Promise<NextResponse> {
  const { slug, id } = await params;
  const authz = await authorize(slug, id);
  if (authz.error) return authz.error;

  await prisma.chatMessage.delete({ where: { id: authz.messageId } });

  return NextResponse.json({ ok: true });
}
