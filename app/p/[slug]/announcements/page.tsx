import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { LinkedText } from "@/components/SafeLink";

const KIND_LABELS: Record<string, string> = {
  update: "Update", release: "Release", roles_open: "Roles open", milestone: "Milestone",
};

// Re-verify the caller can manage this project's announcements.
async function canManage(projectId: string, userId: string) {
  const m = await prisma.membership.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { role: true, leftAt: true },
  });
  return !!m && !m.leftAt && ["owner", "maintainer"].includes(m.role as string);
}

async function publishedTodayCount(projectId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return prisma.announcement.count({ where: { projectId, publishedAt: { gte: today } } });
}

export default async function AnnouncementsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();

  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true, moderationStatus: true },
  });
  if (!project || project.moderationStatus === "removed") notFound();

  const userId = session?.user?.id;
  const membership = userId
    ? await prisma.membership.findUnique({
        where: { projectId_userId: { projectId: project.id, userId } },
        select: { role: true, leftAt: true },
      })
    : null;
  const canPost = !!membership && !membership.leftAt &&
    ["owner", "maintainer"].includes(membership.role as string);

  const announcements = await prisma.announcement.findMany({
    where: {
      projectId: project.id,
      moderationStatus: { not: "removed" },
      // Drafts (no publishedAt) are only visible to people who can post.
      ...(canPost ? {} : { publishedAt: { not: null } }),
    },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { displayName: true, githubLogin: true } } },
  });

  const drafts = announcements.filter((a) => !a.publishedAt);
  const published = announcements.filter((a) => a.publishedAt);

  async function createAnnouncement(formData: FormData) {
    "use server";
    const s = await auth();
    if (!s?.user?.id || !(await canManage(project!.id, s.user.id))) return;

    const title = (formData.get("title") as string)?.trim();
    const body = (formData.get("body") as string)?.trim();
    const kind = (formData.get("kind") as string) || "update";
    const publish = formData.get("intent") === "publish";
    if (!title || !body) return;

    if (publish && (await publishedTodayCount(project!.id)) >= 3) return;

    await prisma.announcement.create({
      data: {
        projectId: project!.id,
        authorId: s.user.id,
        title, body,
        kind: kind as "update" | "release" | "roles_open" | "milestone",
        publishedAt: publish ? new Date() : null,
      },
    });
    redirect(`/p/${slug}/announcements`);
  }

  async function publishDraft(formData: FormData) {
    "use server";
    const s = await auth();
    if (!s?.user?.id || !(await canManage(project!.id, s.user.id))) return;

    const id = formData.get("id") as string;
    const draft = await prisma.announcement.findUnique({ where: { id }, select: { projectId: true, publishedAt: true } });
    if (!draft || draft.projectId !== project!.id || draft.publishedAt) return;
    if ((await publishedTodayCount(project!.id)) >= 3) return;

    await prisma.announcement.update({ where: { id }, data: { publishedAt: new Date() } });
    redirect(`/p/${slug}/announcements`);
  }

  async function deleteDraft(formData: FormData) {
    "use server";
    const s = await auth();
    if (!s?.user?.id || !(await canManage(project!.id, s.user.id))) return;

    const id = formData.get("id") as string;
    const draft = await prisma.announcement.findUnique({ where: { id }, select: { projectId: true, publishedAt: true } });
    if (!draft || draft.projectId !== project!.id || draft.publishedAt) return;

    await prisma.announcement.delete({ where: { id } });
    redirect(`/p/${slug}/announcements`);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display font-bold text-xl text-ink mb-6">Announcements</h1>

      {canPost && (
        <form action={createAnnouncement} className="mb-8 rounded-lg border border-paper-edge bg-paper p-5 space-y-3">
          <p className="font-mono text-xs uppercase tracking-widest text-ink-soft">Post an update</p>
          <input
            name="title" required maxLength={120}
            placeholder="Announcement title"
            className="w-full rounded-md border border-paper-edge bg-paper-bright px-3 py-2 font-sans text-sm text-ink placeholder:text-ink-soft focus:outline-2 focus:outline-pin-gold"
          />
          <div className="flex gap-2">
            <select name="kind" className="rounded-md border border-paper-edge bg-paper-bright px-3 py-2 font-mono text-sm text-ink focus:outline-2 focus:outline-pin-gold">
              <option value="update">Update</option>
              <option value="release">Release</option>
              <option value="roles_open">Roles open</option>
              <option value="milestone">Milestone</option>
            </select>
          </div>
          <textarea
            name="body" required rows={3} maxLength={5000}
            placeholder="What's new?"
            className="w-full resize-y rounded-md border border-paper-edge bg-paper-bright px-3 py-2 font-sans text-sm text-ink placeholder:text-ink-soft focus:outline-2 focus:outline-pin-gold"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit" name="intent" value="publish"
              className="rounded-md bg-pin-teal px-4 py-2 font-mono text-sm text-white shadow-[0_2px_0_#0e5a47] hover:-translate-y-px"
            >
              Publish
            </button>
            <button
              type="submit" name="intent" value="draft"
              className="rounded-md border border-paper-edge px-4 py-2 font-mono text-sm text-ink-soft hover:border-ink-soft hover:text-ink"
            >
              Save draft
            </button>
          </div>
        </form>
      )}

      {/* Drafts — only shown to people who can post */}
      {canPost && drafts.length > 0 && (
        <div className="mb-8">
          <p className="mb-2 font-mono text-[0.65rem] uppercase tracking-widest text-ink-soft">Drafts</p>
          <div className="space-y-3">
            {drafts.map((a) => (
              <div key={a.id} className="rounded-lg border border-dashed border-pin-gold/50 bg-[#fffaf0] p-5">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-ink">{a.title}</span>
                  <span className="rounded-full bg-paper-edge px-2 py-0.5 font-mono text-[0.6rem] text-ink-soft">
                    {KIND_LABELS[a.kind] ?? a.kind}
                  </span>
                  <span className="rounded-full bg-[#fff8e1] px-2 py-0.5 font-mono text-[0.6rem] text-pin-gold">draft</span>
                </div>
                <p className="mb-3 text-sm text-ink/80"><LinkedText text={a.body} /></p>
                <div className="flex items-center gap-2">
                  <form action={publishDraft}>
                    <input type="hidden" name="id" value={a.id} />
                    <button type="submit" className="rounded-md bg-pin-teal px-3 py-1.5 font-mono text-xs text-white shadow-[0_2px_0_#0e5a47] hover:-translate-y-px">
                      Publish
                    </button>
                  </form>
                  <form action={deleteDraft}>
                    <input type="hidden" name="id" value={a.id} />
                    <button type="submit" className="rounded-md border border-paper-edge px-3 py-1.5 font-mono text-xs text-ink-soft hover:border-ink-soft hover:text-pin-red">
                      Discard
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Published */}
      {published.length === 0 ? (
        <p className="rounded-lg border border-dashed border-paper-edge p-10 text-center font-mono text-sm text-ink-soft">
          No announcements yet.
        </p>
      ) : (
        <div className="space-y-4">
          {published.map((a) => (
            <div key={a.id} className="rounded-lg border border-paper-edge bg-paper p-5">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="font-semibold text-sm text-ink">{a.title}</span>
                <span className="rounded-full bg-paper-edge px-2 py-0.5 font-mono text-[0.6rem] text-ink-soft">
                  {KIND_LABELS[a.kind] ?? a.kind}
                </span>
                {a.moderationStatus === "held" && (
                  <span className="rounded-full bg-[#fff8e1] px-2 py-0.5 font-mono text-[0.6rem] text-pin-gold">held</span>
                )}
              </div>
              <p className="text-sm text-ink/80 mb-2"><LinkedText text={a.body} /></p>
              <p className="font-mono text-xs text-ink-soft">
                {a.author?.displayName ?? a.author?.githubLogin} · {a.publishedAt ? new Date(a.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "draft"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
