import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeTag } from "@/lib/tags";
import { apiError } from "@/lib/api";

/** Tag autocomplete: active tags matching the query prefix, most-used first. */
export async function GET(req: NextRequest) {
  try {
    const q = normalizeTag(req.nextUrl.searchParams.get("q") ?? "");

    const tags = await prisma.tag.findMany({
      where: { status: "active", ...(q ? { slug: { startsWith: q } } : {}) },
      select: { slug: true, label: true, _count: { select: { projects: true } } },
      orderBy: { projects: { _count: "desc" } },
      take: 8,
    });

    return Response.json(
      tags.map((t) => ({ slug: t.slug, label: t.label, count: t._count.projects })),
    );
  } catch (e) {
    return apiError(e);
  }
}
