import { after } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/authz";
import { apiError } from "@/lib/api";
import { processDataExport } from "@/lib/account";

function serialize(e: {
  id: string;
  status: string;
  requestedAt: Date;
  completedAt: Date | null;
  expiresAt: Date | null;
}) {
  return {
    id: e.id,
    status: e.status,
    requestedAt: e.requestedAt,
    completedAt: e.completedAt,
    expiresAt: e.expiresAt,
  };
}

// Latest export request for the signed-in user (used by the UI to poll status).
export async function GET() {
  try {
    const user = await requireUser();
    const latest = await prisma.dataExport.findFirst({
      where: { userId: user.id },
      orderBy: { requestedAt: "desc" },
    });
    return Response.json({ export: latest ? serialize(latest) : null });
  } catch (e) {
    return apiError(e);
  }
}

// Request a new data export. Responds immediately and assembles the payload in the
// background via after(); a cron job picks up anything that doesn't finish here.
export async function POST() {
  try {
    const user = await requireUser();

    // Reuse an in-flight request instead of stacking duplicates.
    const existing = await prisma.dataExport.findFirst({
      where: { userId: user.id, status: "pending" },
      orderBy: { requestedAt: "desc" },
    });
    if (existing) {
      return Response.json({ export: serialize(existing) }, { status: 200 });
    }

    const created = await prisma.dataExport.create({
      data: { userId: user.id, status: "pending" },
    });

    after(() => processDataExport(created.id));

    return Response.json({ export: serialize(created) }, { status: 202 });
  } catch (e) {
    return apiError(e);
  }
}
