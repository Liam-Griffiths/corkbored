import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/authz";
import { CreateApplicationSchema } from "@/lib/validators";
import { apiError } from "@/lib/api";

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
    const githubStats = await prisma.githubStats.findUnique({
      where: { userId: user.id },
    });

    const application = await prisma.application.create({
      data: {
        roleId,
        applicantId: user.id,
        pitch: body.pitch,
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
    }

    return Response.json(application, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return Response.json({ error: "You have already applied to this role" }, { status: 409 });
    }
    return apiError(e);
  }
}
