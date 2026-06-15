import { NextRequest, NextResponse } from "next/server";
import { createHmac, randomBytes } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Issues a short-lived HS256 JWT for the Go WebSocket backend.
// Claims: { sub: userId, projectId, jti, iat, exp }
// Signed with AUTH_SECRET (shared with the Go backend).

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function signJWT(payload: Record<string, unknown>, secret: string, expiresInSec = 300): string {
  const header = b64url(Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const now = Math.floor(Date.now() / 1000);
  const body = b64url(
    Buffer.from(JSON.stringify({ ...payload, iat: now, exp: now + expiresInSec, jti: randomBytes(8).toString("hex") })),
  );
  const sig = b64url(
    Buffer.from(createHmac("sha256", secret).update(`${header}.${body}`).digest()),
  );
  return `${header}.${body}.${sig}`;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const slug = req.nextUrl.searchParams.get("project");
  if (!slug) return NextResponse.json({ error: "project required" }, { status: 400 });

  const project = await prisma.project.findUnique({ where: { slug }, select: { id: true } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const membership = await prisma.membership.findUnique({
    where: { projectId_userId: { projectId: project.id, userId: session.user.id }, leftAt: null },
    select: { id: true },
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const secret = process.env.AUTH_SECRET;
  if (!secret) return NextResponse.json({ error: "AUTH_SECRET not set" }, { status: 500 });

  const token = signJWT({ sub: session.user.id, projectId: project.id }, secret, 300);

  return NextResponse.json({ token, projectId: project.id });
}
