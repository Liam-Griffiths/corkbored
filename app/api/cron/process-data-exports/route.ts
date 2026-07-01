import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { processDataExport } from "@/lib/account";

// Safety net for the DSAR export flow: POST /api/account/export builds the payload
// in-process via after(), but if that invocation is interrupted the row stays
// "pending". This cron picks up any pending requests and finishes them, so no
// access request is ever silently dropped.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const pending = await prisma.dataExport.findMany({
    where: { status: "pending" },
    orderBy: { requestedAt: "asc" },
    take: 25,
    select: { id: true },
  });

  for (const { id } of pending) {
    await processDataExport(id);
  }

  return Response.json({ processed: pending.length });
}
