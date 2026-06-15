import { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";

function verifySignature(secret: string, payload: string, sigHeader: string | null): boolean {
  if (!sigHeader?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const expectedBuf = Buffer.from(`sha256=${expected}`, "utf8");
  const receivedBuf = Buffer.from(sigHeader, "utf8");
  if (expectedBuf.length !== receivedBuf.length) return false;
  return timingSafeEqual(expectedBuf, receivedBuf);
}

export async function POST(req: NextRequest) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    return Response.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const rawBody = await req.text();
  const sig = req.headers.get("x-hub-signature-256");

  if (!verifySignature(secret, rawBody, sig)) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = req.headers.get("x-github-event");
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (event === "push") {
    await handlePush(payload);
  } else if (event === "pull_request") {
    await handlePullRequest(payload);
  } else if (event === "release") {
    await handleRelease(payload);
  }

  return new Response(null, { status: 204 });
}

async function resolveProject(repoFullName: string) {
  return prisma.project.findFirst({ where: { repoFullName } });
}

async function resolveUser(githubLogin: string) {
  return prisma.user.findFirst({ where: { githubLogin } });
}

async function upsertEvent(data: {
  projectId: string;
  userId: string;
  kind: "commit" | "pr_merged" | "release";
  externalId: string;
  metadata?: Record<string, string | number | null | undefined>;
  occurredAt: Date;
}) {
  await prisma.contributionEvent.upsert({
    where: { projectId_kind_externalId: { projectId: data.projectId, kind: data.kind, externalId: data.externalId } },
    update: {},
    create: {
      projectId: data.projectId,
      userId: data.userId,
      kind: data.kind,
      externalId: data.externalId,
      metadata: data.metadata,
      occurredAt: data.occurredAt,
    },
  });
}

async function handlePush(payload: Record<string, unknown>) {
  const repo = (payload.repository as Record<string, unknown>)?.full_name as string;
  if (!repo) return;
  const project = await resolveProject(repo);
  if (!project) return;

  const commits = (payload.commits as Array<Record<string, unknown>>) ?? [];
  for (const commit of commits) {
    const sha = commit.id as string;
    const authorLogin = (commit.author as Record<string, unknown>)?.username as string | undefined;
    const message = commit.message as string | undefined;
    const timestamp = commit.timestamp as string | undefined;

    let userId = project.ownerId;
    if (authorLogin) {
      const user = await resolveUser(authorLogin);
      if (user) userId = user.id;
    }

    await upsertEvent({
      projectId: project.id,
      userId,
      kind: "commit",
      externalId: sha,
      metadata: { message: message?.slice(0, 200), authorLogin },
      occurredAt: timestamp ? new Date(timestamp) : new Date(),
    });
  }
}

async function handlePullRequest(payload: Record<string, unknown>) {
  if (payload.action !== "closed") return;
  const pr = payload.pull_request as Record<string, unknown>;
  if (!pr?.merged) return;

  const repo = (payload.repository as Record<string, unknown>)?.full_name as string;
  if (!repo) return;
  const project = await resolveProject(repo);
  if (!project) return;

  const prId = String(pr.number);
  const authorLogin = (pr.user as Record<string, unknown>)?.login as string | undefined;
  const mergedAt = pr.merged_at as string | null;

  let userId = project.ownerId;
  if (authorLogin) {
    const user = await resolveUser(authorLogin);
    if (user) userId = user.id;
  }

  await upsertEvent({
    projectId: project.id,
    userId,
    kind: "pr_merged",
    externalId: prId,
    metadata: { title: (pr.title as string)?.slice(0, 200), authorLogin },
    occurredAt: mergedAt ? new Date(mergedAt) : new Date(),
  });
}

async function handleRelease(payload: Record<string, unknown>) {
  if (payload.action !== "published") return;

  const repo = (payload.repository as Record<string, unknown>)?.full_name as string;
  if (!repo) return;
  const project = await resolveProject(repo);
  if (!project) return;

  const release = payload.release as Record<string, unknown>;
  const tagName = release.tag_name as string;
  const authorLogin = (release.author as Record<string, unknown>)?.login as string | undefined;
  const publishedAt = release.published_at as string | null;

  let userId = project.ownerId;
  if (authorLogin) {
    const user = await resolveUser(authorLogin);
    if (user) userId = user.id;
  }

  await upsertEvent({
    projectId: project.id,
    userId,
    kind: "release",
    externalId: tagName,
    metadata: { name: (release.name as string)?.slice(0, 200), tagName, authorLogin },
    occurredAt: publishedAt ? new Date(publishedAt) : new Date(),
  });
}
