import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireProjectOwner } from "@/lib/authz";
import { PatchProjectSchema } from "@/lib/validators";
import { upsertTagsByLabel } from "@/lib/tags";
import { apiError } from "@/lib/api";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;

    const project = await prisma.project.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!project) return Response.json({ error: "Not found" }, { status: 404 });

    await requireProjectOwner(project.id);

    const body = PatchProjectSchema.parse(await req.json());
    const { tags, ...fields } = body;

    await prisma.$transaction(async (tx) => {
      if (Object.keys(fields).length > 0) {
        await tx.project.update({ where: { id: project.id }, data: fields });
      }
      if (tags) {
        const tagIds = await upsertTagsByLabel(tx, tags);
        await tx.projectTag.deleteMany({ where: { projectId: project.id } });
        await tx.projectTag.createMany({
          data: tagIds.map((tagId) => ({ projectId: project.id, tagId })),
          skipDuplicates: true,
        });
      }
    });

    revalidatePath(`/p/${slug}`, "layout");

    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
