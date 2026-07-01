import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";

export const INVITE_TTL_DAYS = 14;

export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://corkbored.com";
}

export function inviteUrl(token: string): string {
  return `${appUrl()}/invite/${token}`;
}

export function generateInviteToken(): string {
  // 32 bytes of entropy, URL-safe — this token is the capability to join.
  return randomBytes(32).toString("base64url");
}

/**
 * Accept an invite for a signed-in user: idempotently create/restore their
 * membership and mark the invite accepted. Returns the project slug to redirect
 * to, or null if the invite can't be accepted (missing / expired / revoked).
 */
export async function acceptInvite(
  token: string,
  userId: string,
): Promise<{ slug: string } | null> {
  const invite = await prisma.projectInvite.findUnique({
    where: { token },
    include: { project: { select: { id: true, slug: true, moderationStatus: true } } },
  });

  if (!invite || invite.project.moderationStatus === "removed") return null;
  if (invite.status === "revoked" || invite.status === "failed") return null;
  if (invite.status !== "accepted" && invite.expiresAt < new Date()) return null;

  const projectId = invite.project.id;

  await prisma.$transaction(async (tx) => {
    const existing = await tx.membership.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });

    if (!existing) {
      await tx.membership.create({
        data: { projectId, userId, role: invite.role },
      });
    } else if (existing.leftAt) {
      // Re-joining after having left — restore, don't touch an owner's role.
      await tx.membership.update({
        where: { id: existing.id },
        data: {
          leftAt: null,
          removedById: null,
          role: existing.role === "owner" ? "owner" : invite.role,
        },
      });
    }

    if (invite.status !== "accepted") {
      await tx.projectInvite.update({
        where: { id: invite.id },
        data: { status: "accepted", acceptedById: userId, acceptedAt: new Date() },
      });

      // Let the inviter know — unless they invited themselves.
      if (invite.invitedById !== userId) {
        await tx.notification.create({
          data: { userId: invite.invitedById, kind: "invite_accepted", projectId },
        });
      }
    }
  });

  return { slug: invite.project.slug };
}
