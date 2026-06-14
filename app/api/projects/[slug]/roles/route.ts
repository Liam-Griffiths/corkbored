import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireProjectOwner } from "@/lib/authz";
import { CreateRoleSchema } from "@/lib/validators";
import { apiError } from "@/lib/api";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const project = await prisma.project.findUnique({ where: { slug } });
    if (!project) return Response.json({ error: "Not found" }, { status: 404 });

    await requireProjectOwner(project.id);

    const openCount = await prisma.role.count({
      where: { projectId: project.id, status: "open" },
    });
    if (openCount >= 5) {
      return Response.json(
        { error: "Maximum 5 open roles per project" },
        { status: 422 },
      );
    }

    const body = CreateRoleSchema.parse(await req.json());
    const role = await prisma.role.create({
      data: { projectId: project.id, ...body },
    });

    return Response.json(role, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
