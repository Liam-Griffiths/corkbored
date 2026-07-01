import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, AuthError } from "@/lib/authz";
import { apiError } from "@/lib/api";
import { CreateInviteSchema } from "@/lib/validators";
import { generateInviteToken, inviteUrl, INVITE_TTL_DAYS } from "@/lib/invite";
import { sendProjectInvite } from "@/lib/email";
import { limitsFor, tierForUser } from "@/lib/limits";

async function getProject(slug: string) {
  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true, title: true, moderationStatus: true },
  });
  if (!project || project.moderationStatus === "removed") return null;
  return project;
}

// Only owners and maintainers can manage invites.
async function requireManager(projectId: string, userId: string) {
  const membership = await prisma.membership.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { role: true, leftAt: true },
  });
  if (!membership || membership.leftAt || membership.role === "member") {
    throw new AuthError(403, "Project manager access required");
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const user = await requireUser();
    const project = await getProject(slug);
    if (!project) return Response.json({ error: "Not found" }, { status: 404 });
    await requireManager(project.id, user.id);

    const invites = await prisma.projectInvite.findMany({
      where: { projectId: project.id, status: { in: ["pending", "sent"] } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        role: true,
        token: true,
        status: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    return Response.json({
      invites: invites.map((i) => ({ ...i, url: inviteUrl(i.token) })),
    });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const user = await requireUser();
    const project = await getProject(slug);
    if (!project) return Response.json({ error: "Not found" }, { status: 404 });
    await requireManager(project.id, user.id);

    const { email, role } = CreateInviteSchema.parse(await req.json());
    const normalizedEmail = email.trim().toLowerCase();

    // Rate limit: cap how many invites one person can send per day, to stop the
    // endpoint being used to send spam through our domain.
    const maxPerDay = limitsFor(await tierForUser(user.id)).invitesPerDay;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sentToday = await prisma.projectInvite.count({
      where: { invitedById: user.id, createdAt: { gte: since } },
    });
    if (sentToday >= maxPerDay) {
      return Response.json(
        { error: `Invite limit reached for today (${maxPerDay}/day)` },
        { status: 429 },
      );
    }

    // Already a member?
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (existingUser) {
      const member = await prisma.membership.findUnique({
        where: { projectId_userId: { projectId: project.id, userId: existingUser.id } },
        select: { leftAt: true },
      });
      if (member && !member.leftAt) {
        return Response.json(
          { error: "That person is already on the team" },
          { status: 409 },
        );
      }
    }

    // Reuse an outstanding invite for the same email instead of stacking them.
    const existingInvite = await prisma.projectInvite.findFirst({
      where: {
        projectId: project.id,
        email: normalizedEmail,
        status: { in: ["pending", "sent"] },
      },
    });

    const token = existingInvite?.token ?? generateInviteToken();
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

    const invite = existingInvite
      ? await prisma.projectInvite.update({
          where: { id: existingInvite.id },
          data: { role: role ?? "member", expiresAt, invitedById: user.id },
        })
      : await prisma.projectInvite.create({
          data: {
            projectId: project.id,
            email: normalizedEmail,
            role: role ?? "member",
            token,
            invitedById: user.id,
            expiresAt,
          },
        });

    const inviter = await prisma.user.findUnique({
      where: { id: user.id },
      select: { displayName: true, githubLogin: true },
    });

    const url = inviteUrl(token);
    // emailSent is true only when the provider actually delivered. When email is
    // turned off (or the send throws), the invite still stands — the owner shares
    // the link manually via the modal on the client.
    let emailSent = false;
    try {
      emailSent = await sendProjectInvite({
        to: normalizedEmail,
        inviterName: inviter?.displayName ?? inviter?.githubLogin ?? "A teammate",
        projectTitle: project.title,
        roleName: invite.role,
        inviteUrl: url,
      });
      if (emailSent) {
        await prisma.projectInvite.update({
          where: { id: invite.id },
          data: { status: "sent" },
        });
      }
    } catch (err) {
      // Don't fail the request — the link still works, owner can copy it.
      console.error("[invite] email send failed", err);
      emailSent = false;
    }

    return Response.json(
      {
        invite: {
          id: invite.id,
          email: invite.email,
          role: invite.role,
          status: emailSent ? "sent" : "pending",
          expiresAt: invite.expiresAt,
          createdAt: invite.createdAt,
          url,
        },
        emailSent,
      },
      { status: 201 },
    );
  } catch (e) {
    return apiError(e);
  }
}
