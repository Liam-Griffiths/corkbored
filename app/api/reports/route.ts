import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/authz";
import { CreateReportSchema } from "@/lib/validators";
import { apiError } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();

    // Rate limit: 10 reports per day
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await prisma.report.count({
      where: { reporterId: user.id, createdAt: { gte: today } },
    });
    if (todayCount >= 10) {
      return Response.json({ error: "Report limit reached for today (10/day)" }, { status: 429 });
    }

    const body = CreateReportSchema.parse(await req.json());

    const report = await prisma.$transaction(async (tx) => {
      const r = await tx.report.create({
        data: {
          reporterId: user.id,
          subjectType: body.subjectType,
          subjectId: body.subjectId,
          reason: body.reason,
        },
      });

      await tx.moderationItem.create({
        data: {
          subjectType: body.subjectType,
          subjectId: body.subjectId,
          reportId: r.id,
          ...(body.subjectType === "application" && { applicationId: body.subjectId }),
          ...(body.subjectType === "announcement" && { announcementId: body.subjectId }),
        },
      });

      return r;
    });

    return Response.json({ id: report.id }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
