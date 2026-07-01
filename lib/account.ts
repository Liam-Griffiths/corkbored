import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { sendDataExportReady } from "@/lib/email";
import { appUrl } from "@/lib/invite";

// How long a generated export stays downloadable before it's considered expired.
export const EXPORT_TTL_DAYS = 7;

/**
 * Assemble a complete copy of the personal data we hold about a user (GDPR right
 * of access). OAuth token values are deliberately excluded — exposing live access
 * tokens in a downloadable file would be a security risk; we list the linked
 * providers instead.
 */
export async function buildDataExport(userId: string): Promise<Record<string, unknown>> {
  const [
    user,
    accounts,
    memberships,
    ownedProjects,
    applications,
    announcements,
    messages,
    chatMessages,
    assignedTasks,
    createdTasks,
    contributions,
    createdEvents,
    postVotes,
    projectFollows,
    following,
    followers,
    reports,
    sentInvites,
    notifications,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: { skills: true, links: true, githubStats: true },
    }),
    prisma.account.findMany({
      where: { userId },
      // Token values intentionally omitted.
      select: { provider: true, providerAccountId: true, type: true, scope: true },
    }),
    prisma.membership.findMany({
      where: { userId },
      include: { project: { select: { slug: true, title: true } } },
    }),
    prisma.project.findMany({ where: { ownerId: userId } }),
    prisma.application.findMany({
      where: { applicantId: userId },
      include: { role: { select: { title: true, project: { select: { slug: true, title: true } } } } },
    }),
    prisma.announcement.findMany({ where: { authorId: userId } }),
    prisma.message.findMany({ where: { authorId: userId } }),
    prisma.chatMessage.findMany({ where: { userId } }),
    prisma.task.findMany({ where: { assigneeId: userId } }),
    prisma.task.findMany({ where: { createdById: userId } }),
    prisma.contributionEvent.findMany({ where: { userId } }),
    prisma.event.findMany({ where: { createdById: userId } }),
    prisma.postVote.findMany({ where: { userId } }),
    prisma.projectFollow.findMany({
      where: { userId },
      include: { project: { select: { slug: true, title: true } } },
    }),
    prisma.userFollow.findMany({
      where: { followerId: userId },
      include: { following: { select: { githubLogin: true, displayName: true } } },
    }),
    prisma.userFollow.findMany({
      where: { followingId: userId },
      include: { follower: { select: { githubLogin: true, displayName: true } } },
    }),
    prisma.report.findMany({ where: { reporterId: userId } }),
    prisma.projectInvite.findMany({ where: { invitedById: userId } }),
    prisma.notification.findMany({ where: { userId } }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    notice:
      "This is a copy of the personal data Corkbored holds about your account. " +
      "OAuth token values are excluded for security. Questions: privacy@corkbored.com.",
    profile: user,
    linkedAccounts: accounts,
    memberships,
    ownedProjects,
    applications,
    announcements,
    discussionMessages: messages,
    chatMessages,
    tasksAssignedToYou: assignedTasks,
    tasksYouCreated: createdTasks,
    contributions,
    eventsYouCreated: createdEvents,
    postVotes,
    projectFollows,
    following,
    followers,
    reportsYouFiled: reports,
    invitesYouSent: sentInvites,
    notifications,
  };
}

/**
 * Build the export payload for a pending DataExport row and mark it ready (or
 * failed). Safe to call from a background task or a cron retry — it no-ops if the
 * row isn't pending.
 */
export async function processDataExport(exportId: string): Promise<void> {
  const record = await prisma.dataExport.findUnique({ where: { id: exportId } });
  if (!record || record.status !== "pending") return;

  try {
    const payload = await buildDataExport(record.userId);
    // Normalize to plain JSON (Dates -> ISO strings) for jsonb storage.
    const jsonPayload = JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue;
    const expiresAt = new Date(Date.now() + EXPORT_TTL_DAYS * 24 * 60 * 60 * 1000);
    await prisma.dataExport.update({
      where: { id: exportId },
      data: { status: "ready", payload: jsonPayload, completedAt: new Date(), expiresAt },
    });

    // Notify the user their export is ready (non-fatal; respects the email flags).
    try {
      const owner = await prisma.user.findUnique({
        where: { id: record.userId },
        select: { email: true },
      });
      if (owner?.email) {
        await sendDataExportReady({
          to: owner.email,
          downloadUrl: `${appUrl()}/api/account/export/${exportId}`,
        });
      }
    } catch (mailErr) {
      console.error("[data-export] ready email failed", exportId, mailErr);
    }
  } catch (err) {
    console.error("[data-export] failed", exportId, err);
    await prisma.dataExport.update({
      where: { id: exportId },
      data: { status: "failed", error: err instanceof Error ? err.message : "unknown error" },
    });
  }
}

/**
 * Permanently delete a user account and the personal data tied to it (GDPR right
 * to erasure / hard delete).
 *
 * The schema uses ON DELETE RESTRICT for most authored content, so we cannot just
 * call `user.delete()` — we have to remove the user's footprint in dependency
 * order first. Everything runs inside a single transaction, so if any foreign-key
 * ordering is wrong the whole operation rolls back and nothing is corrupted.
 *
 * What happens:
 *  - Projects the user solely owns are deleted, cascading their members, roles,
 *    applications, announcements, tasks, messages, events, invites, etc.
 *  - The user's content in OTHER people's projects (applications, announcements,
 *    messages, chat, contributions, events, invites, reports) is deleted.
 *  - Attribution-only references (task assignee/creator, moderation decider,
 *    membership remover, accepted-invite) are nulled so other users' data stays
 *    intact.
 *  - The user row is deleted, cascading accounts, sessions, skills, GitHub stats,
 *    notifications, profile links, votes, and follows.
 */
export async function deleteUserAccount(userId: string): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      // 1. Projects the user owns — clear the FK blockers, then delete the subtree.
      const owned = await tx.project.findMany({
        where: { ownerId: userId },
        select: { id: true },
      });
      const ownedIds = owned.map((p) => p.id);

      if (ownedIds.length > 0) {
        const appsInOwned = await tx.application.findMany({
          where: { role: { projectId: { in: ownedIds } } },
          select: { id: true },
        });
        const annsInOwned = await tx.announcement.findMany({
          where: { projectId: { in: ownedIds } },
          select: { id: true },
        });

        // ModerationItem -> application/announcement is RESTRICT (no projectId).
        await tx.moderationItem.deleteMany({
          where: {
            OR: [
              { applicationId: { in: appsInOwned.map((a) => a.id) } },
              { announcementId: { in: annsInOwned.map((a) => a.id) } },
            ],
          },
        });

        // Message.parent is a RESTRICT self-relation; detach before cascade delete.
        await tx.message.updateMany({
          where: { projectId: { in: ownedIds } },
          data: { parentId: null },
        });

        await tx.project.deleteMany({ where: { id: { in: ownedIds } } });
      }

      // 2. The user's content in projects they don't own.
      const myApps = await tx.application.findMany({
        where: { applicantId: userId },
        select: { id: true },
      });
      const myAnns = await tx.announcement.findMany({
        where: { authorId: userId },
        select: { id: true },
      });
      const myReports = await tx.report.findMany({
        where: { reporterId: userId },
        select: { id: true },
      });
      const myMsgs = await tx.message.findMany({
        where: { authorId: userId },
        select: { id: true },
      });

      // Notifications and moderation items referencing the user's content (these
      // may belong to other users, so they aren't cascade-deleted with the user).
      await tx.notification.deleteMany({
        where: {
          OR: [
            { applicationId: { in: myApps.map((a) => a.id) } },
            { announcementId: { in: myAnns.map((a) => a.id) } },
          ],
        },
      });
      await tx.moderationItem.deleteMany({
        where: {
          OR: [
            { applicationId: { in: myApps.map((a) => a.id) } },
            { announcementId: { in: myAnns.map((a) => a.id) } },
            { reportId: { in: myReports.map((r) => r.id) } },
          ],
        },
      });

      // Detach replies to the user's messages so deleting them doesn't violate
      // the parent self-relation, then delete (PostVotes cascade with the message).
      if (myMsgs.length > 0) {
        await tx.message.updateMany({
          where: { parentId: { in: myMsgs.map((m) => m.id) } },
          data: { parentId: null },
        });
      }

      await tx.application.deleteMany({ where: { applicantId: userId } });
      await tx.announcement.deleteMany({ where: { authorId: userId } });
      await tx.message.deleteMany({ where: { authorId: userId } });
      await tx.report.deleteMany({ where: { reporterId: userId } });
      await tx.contributionEvent.deleteMany({ where: { userId } });
      await tx.chatMessage.deleteMany({ where: { userId } });
      await tx.event.deleteMany({ where: { createdById: userId } });
      await tx.projectInvite.deleteMany({ where: { invitedById: userId } });
      await tx.membership.deleteMany({ where: { userId } });

      // 3. Null attribution-only references on data owned by others.
      await tx.projectInvite.updateMany({
        where: { acceptedById: userId },
        data: { acceptedById: null },
      });
      await tx.task.updateMany({ where: { assigneeId: userId }, data: { assigneeId: null } });
      await tx.task.updateMany({ where: { createdById: userId }, data: { createdById: null } });
      await tx.membership.updateMany({
        where: { removedById: userId },
        data: { removedById: null },
      });
      await tx.moderationItem.updateMany({
        where: { decidedById: userId },
        data: { decidedById: null },
      });

      // 4. Finally the user — cascades accounts, sessions, skills, GitHub stats,
      // own notifications, profile links, votes, and follows.
      await tx.user.delete({ where: { id: userId } });
    },
    { timeout: 20000 },
  );
}
