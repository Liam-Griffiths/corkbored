import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireProjectMember } from "@/lib/authz";
import { PatchEventSchema } from "@/lib/validators";
import { apiError } from "@/lib/api";

const creatorSelect = { id: true, displayName: true, githubLogin: true, avatarUrl: true };

// Any team member can edit/delete events; confirm the event belongs to this project.
async function loadEvent(slug: string, id: string) {
  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true, startAt: true, endAt: true, project: { select: { id: true, slug: true } } },
  });
  if (!event || event.project.slug !== slug) return null;
  return event;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  try {
    const { slug, id } = await params;
    const event = await loadEvent(slug, id);
    if (!event) return Response.json({ error: "Not found" }, { status: 404 });
    await requireProjectMember(event.project.id);

    const body = PatchEventSchema.parse(await req.json());

    // Validate the resulting time window against whichever side isn't being changed.
    const nextStart = body.startAt ? new Date(body.startAt) : event.startAt;
    const nextEnd = body.endAt !== undefined ? (body.endAt ? new Date(body.endAt) : null) : event.endAt;
    if (nextEnd && nextEnd < nextStart) {
      return Response.json({ error: "End time can't be before start time" }, { status: 422 });
    }

    const updated = await prisma.event.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description ?? null } : {}),
        ...(body.location !== undefined ? { location: body.location ?? null } : {}),
        ...(body.startAt !== undefined ? { startAt: new Date(body.startAt) } : {}),
        ...(body.endAt !== undefined ? { endAt: body.endAt ? new Date(body.endAt) : null } : {}),
        ...(body.allDay !== undefined ? { allDay: body.allDay } : {}),
      },
      include: { createdBy: { select: creatorSelect } },
    });

    return Response.json(updated);
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  try {
    const { slug, id } = await params;
    const event = await loadEvent(slug, id);
    if (!event) return Response.json({ error: "Not found" }, { status: 404 });
    await requireProjectMember(event.project.id);

    await prisma.event.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
