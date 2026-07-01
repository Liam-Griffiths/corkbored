import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/authz";
import { CreateApplicationSchema } from "@/lib/validators";
import { apiError } from "@/lib/api";
import { triage } from "@/lib/moderation";
import { sendApplicationReceived, notificationEmailsEnabled } from "@/lib/email";
import { appUrl } from "@/lib/invite";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: roleId } = await params;
    const user = await requireUser();

    const role = await prisma.role.findUnique({
      where: { id: roleId },
      include: { project: { include: { memberships: { where: { role: "owner", leftAt: null } } } } },
    });
    if (!role || role.status !== "open") {
      return Response.json({ error: "Role not found or closed" }, { status: 404 });
    }

    // Owner cannot apply to their own project
    const isOwner = role.project.memberships.some((m) => m.userId === user.id);
    if (isOwner) {
      return Response.json(
        { error: "You cannot apply to your own project" },
        { status: 422 },
      );
    }

    // Rate limit: 10 applications per day
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await prisma.application.count({
      where: { applicantId: user.id, createdAt: { gte: today } },
    });
    if (todayCount >= 10) {
      return Response.json(
        { error: "Application limit reached for today (10/day)" },
        { status: 429 },
      );
    }

    const body = CreateApplicationSchema.parse(await req.json());

    // Cache applicant's GitHub stats at time of application
    const [githubStats, triageResult] = await Promise.all([
      prisma.githubStats.findUnique({ where: { userId: user.id } }),
      triage("application", body.pitch, `role: ${role.title}, project: ${role.project.title}`),
    ]);

    const application = await prisma.$transaction(async (tx) => {
      const app = await tx.application.create({
        data: {
          roleId,
          applicantId: user.id,
          pitch: body.pitch,
          moderationStatus: triageResult.verdict === "spam" ? "held" : "published",
          githubStatsCache: githubStats
            ? {
                accountAgeYears: githubStats.accountAgeYears,
                publicRepos: githubStats.publicRepos,
                commitsLast90d: githubStats.commitsLast90d,
                topLanguages: githubStats.topLanguages,
              }
            : undefined,
        },
      });

      if (triageResult.verdict !== "clean") {
        await tx.moderationItem.create({
          data: {
            subjectType: "application",
            subjectId: app.id,
            applicationId: app.id,
            verdict: triageResult.verdict,
            confidence: triageResult.confidence,
            reasons: triageResult.reasons,
          },
        });
      }

      return app;
    });

    // Notify project owner
    const ownerMembership = role.project.memberships[0];
    if (ownerMembership) {
      await prisma.notification.create({
        data: {
          userId: ownerMembership.userId,
          kind: "application_received",
          projectId: role.projectId,
          applicationId: application.id,
        },
      });

      // Email the owner (non-fatal; gated by the notification-email flag).
      if (notificationEmailsEnabled()) {
        try {
          const [owner, applicant] = await Promise.all([
            prisma.user.findUnique({
              where: { id: ownerMembership.userId },
              select: { email: true },
            }),
            prisma.user.findUnique({
              where: { id: user.id },
              select: { displayName: true, githubLogin: true },
            }),
          ]);
          if (owner?.email) {
            await sendApplicationReceived({
              ownerEmail: owner.email,
              applicantName: applicant?.displayName ?? applicant?.githubLogin ?? "Someone",
              projectTitle: role.project.title,
              roleName: role.title,
              dashboardUrl: `${appUrl()}/p/${role.project.slug}/applications`,
            });
          }
        } catch (err) {
          console.error("[email] application received failed", err);
        }
      }
    }

    return Response.json(application, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return Response.json({ error: "You have already applied to this role" }, { status: 409 });
    }
    return apiError(e);
  }
}
