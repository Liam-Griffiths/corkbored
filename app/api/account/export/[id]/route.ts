import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/authz";
import { apiError } from "@/lib/api";

// Download a finished export as a JSON attachment. Owner-only.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await requireUser();

    const record = await prisma.dataExport.findUnique({ where: { id } });
    if (!record || record.userId !== user.id) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    if (record.status !== "ready" || !record.payload) {
      return Response.json({ error: "Export is not ready" }, { status: 409 });
    }
    if (record.expiresAt && record.expiresAt < new Date()) {
      return Response.json({ error: "Export has expired — request a new one" }, { status: 410 });
    }

    const filename = `corkbored-data-export-${record.completedAt?.toISOString().slice(0, 10) ?? id}.json`;
    return new Response(JSON.stringify(record.payload, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
