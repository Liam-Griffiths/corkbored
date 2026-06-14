import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireProjectOwner } from "@/lib/authz";
import { PatchApplicationSchema } from "@/lib/validators";
import { inviteCollaborator } from "@/lib/github";
import { apiError } from "@/lib/api";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const application = await prisma.application.findUnique({
      where: { id },
      include: {
        role: { include: { project: true } },
        applicant: { select: { githubLogin: true } },
      },
    });
    if (!application) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    await requireProjectOwner(application.role.projectId);

    const { status } = PatchApplicationSchema.parse(await req.json());

    const updated = await prisma.$transaction(async (tx) => {
      const app = await tx.application.update({
        where: { id },
        data: { status },
      });

      if (status === "accepted") {
        // Create membership (upsert in case they somehow already have one)
        await tx.membership.upsert({
          where: {
            projectId_userId: {
              projectId: application.role.projectId,
              userId: application.applicantId,
            },
          },
          update: { leftAt: null },
          create: {
            projectId: application.role.projectId,
            userId: application.applicantId,
            role: "member",
          },
        });
      }

      // Notify applicant of decision
      await tx.notification.create({
        data: {
          userId: application.applicantId,
          kind: "application_decided",
          projectId: application.role.projectId,
          applicationId: id,
        },
      });

      return app;
    });

    // Send GitHub repo invite if accepted (outside transaction — failure is non-fatal)
    if (status === "accepted" && application.applicant.githubLogin) {
      const invite = await inviteCollaborator(
        application.role.project.repoFullName,
        application.applicant.githubLogin,
      );
      await prisma.application.update({
        where: { id },
        data: {
          githubInviteStatus: invite.ok ? "sent" : "failed",
        },
      });
    }

    return Response.json(updated);
  } catch (e) {
    return apiError(e);
  }
}
