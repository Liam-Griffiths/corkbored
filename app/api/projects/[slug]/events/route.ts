import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireProjectMember } from "@/lib/authz";
import { CreateEventSchema } from "@/lib/validators";
import { apiError } from "@/lib/api";

const creatorSelect = { id: true, displayName: true, githubLogin: true, avatarUrl: true };

async function getProjectId(slug: string): Promise<string | null> {
  const project = await prisma.project.findUnique({ where: { slug }, select: { id: true } });
  return project?.id ?? null;
}

// List events, optionally within a [from, to) window (ISO strings).
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const projectId = await getProjectId(slug);
    if (!projectId) return Response.json({ error: "Not found" }, { status: 404 });
    await requireProjectMember(projectId);

    const from = req.nextUrl.searchParams.get("from");
    const to = req.nextUrl.searchParams.get("to");

    const events = await prisma.event.findMany({
      where: {
        projectId,
        ...(from || to
          ? { startAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lt: new Date(to) } : {}) } }
          : {}),
      },
      orderBy: { startAt: "asc" },
      include: { createdBy: { select: creatorSelect } },
    });

    return Response.json(events);
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const projectId = await getProjectId(slug);
    if (!projectId) return Response.json({ error: "Not found" }, { status: 404 });
    const user = await requireProjectMember(projectId);

    const body = CreateEventSchema.parse(await req.json());
    if (body.endAt && new Date(body.endAt) < new Date(body.startAt)) {
      return Response.json({ error: "End time can't be before start time" }, { status: 422 });
    }

    const event = await prisma.event.create({
      data: {
        projectId,
        createdById: user.id,
        title: body.title,
        description: body.description ?? null,
        location: body.location ?? null,
        startAt: new Date(body.startAt),
        endAt: body.endAt ? new Date(body.endAt) : null,
        allDay: body.allDay ?? false,
        isPublic: body.isPublic ?? false,
      },
      include: { createdBy: { select: creatorSelect } },
    });

    return Response.json(event, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
