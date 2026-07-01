import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, AuthError } from "@/lib/authz";
import { CreateAnnouncementSchema } from "@/lib/validators";
import { apiError } from "@/lib/api";
import { triage } from "@/lib/moderation";
import { limitsFor } from "@/lib/limits";
import { sendNewAnnouncement, notificationEmailsEnabled } from "@/lib/email";
import { appUrl } from "@/lib/invite";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const user = await requireUser();

    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        memberships: { where: { userId: user.id, leftAt: null } },
        owner: { select: { tier: true } },
      },
    });
    if (!project) return Response.json({ error: "Not found" }, { status: 404 });

    const myMembership = project.memberships[0];
    if (!myMembership || !["owner", "maintainer"].includes(myMembership.role as string)) {
      throw new AuthError(403, "Only owner or maintainer can post announcements");
    }

    // Rate limit announcements per project per day — keyed off the owner's tier.
    const maxPerDay = limitsFor(project.owner.tier).announcementsPerDay;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await prisma.announcement.count({
      where: { projectId: project.id, createdAt: { gte: today } },
    });
    if (todayCount >= maxPerDay) {
      return Response.json(
        { error: `Announcement limit reached for today (${maxPerDay}/day per project)` },
        { status: 429 },
      );
    }

    const body = CreateAnnouncementSchema.parse(await req.json());

    // LLM triage
    const triageResult = await triage(
      "announcement",
      `${body.title}\n\n${body.body}`,
      `project: ${project.title}`,
    );

    const announcement = await prisma.$transaction(async (tx) => {
      const a = await tx.announcement.create({
        data: {
          projectId: project.id,
          authorId: user.id,
          title: body.title,
          summary: body.summary?.trim() || null,
          body: body.body,
          kind: body.kind,
          publishedAt: new Date(),
          moderationStatus: triageResult.verdict === "spam" ? "held" : "published",
        },
      });

      if (triageResult.verdict !== "clean") {
        await tx.moderationItem.create({
          data: {
            subjectType: "announcement",
            subjectId: a.id,
            announcementId: a.id,
            verdict: triageResult.verdict,
            confidence: triageResult.confidence,
            reasons: triageResult.reasons,
          },
        });
      }

      return a;
    });

    // Notify active members + project followers (except the author), deduplicated
    const [memberships, followers] = await Promise.all([
      prisma.membership.findMany({
        where: { projectId: project.id, leftAt: null, userId: { not: user.id } },
        select: { userId: true },
      }),
      prisma.projectFollow.findMany({
        where: { projectId: project.id, userId: { not: user.id } },
        select: { userId: true },
      }),
    ]);

    const recipientIds = [...new Set([
      ...memberships.map((m) => m.userId),
      ...followers.map((f) => f.userId),
    ])];

    if (recipientIds.length > 0) {
      await prisma.notification.createMany({
        data: recipientIds.map((userId) => ({
          userId,
          kind: "new_announcement" as const,
          projectId: project.id,
          announcementId: announcement.id,
        })),
      });

      // Fan out emails to recipients (non-fatal). Only do the email lookup when
      // notification emails are on — this can be a large recipient set.
      if (notificationEmailsEnabled()) {
        try {
          const recipients = await prisma.user.findMany({
            where: { id: { in: recipientIds }, email: { not: null } },
            select: { email: true },
          });
          const announcementUrl = `${appUrl()}/p/${project.slug}/announcements/${announcement.id}`;
          await Promise.allSettled(
            recipients.map((r) =>
              sendNewAnnouncement({
                memberEmail: r.email!,
                projectTitle: project.title,
                announcementTitle: announcement.title,
                projectUrl: announcementUrl,
              }),
            ),
          );
        } catch (err) {
          console.error("[email] announcement fan-out failed", err);
        }
      }
    }

    return Response.json(announcement, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
