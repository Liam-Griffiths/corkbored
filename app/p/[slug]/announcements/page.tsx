import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { summaryOf } from "@/lib/text";
import { MarkdownEditor } from "@/components/MarkdownEditor";

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

export default async function AnnouncementsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { slug } = await params;
  const { edit } = await searchParams;
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

  // Draft currently being edited (must be an unpublished draft on this project).
  const editingDraft = canPost && edit
    ? drafts.find((a) => a.id === edit) ?? null
    : null;

  async function createAnnouncement(formData: FormData) {
    "use server";
    const s = await auth();
    if (!s?.user?.id || !(await canManage(project!.id, s.user.id))) return;

    const title = (formData.get("title") as string)?.trim();
    const summary = (formData.get("summary") as string)?.trim() || null;
    const body = (formData.get("body") as string)?.trim();
    const kind = (formData.get("kind") as string) || "update";
    const publish = formData.get("intent") === "publish";
    if (!title || !body) return;

    if (publish && (await publishedTodayCount(project!.id)) >= 3) return;

    await prisma.announcement.create({
      data: {
        projectId: project!.id,
        authorId: s.user.id,
        title, summary, body,
        kind: kind as "update" | "release" | "roles_open" | "milestone",
        publishedAt: publish ? new Date() : null,
      },
    });
    redirect(`/p/${slug}/announcements`);
  }

  async function updateAnnouncement(formData: FormData) {
    "use server";
    const s = await auth();
    if (!s?.user?.id || !(await canManage(project!.id, s.user.id))) return;

    const id = formData.get("id") as string;
    const draft = await prisma.announcement.findUnique({ where: { id }, select: { projectId: true, publishedAt: true } });
    if (!draft || draft.projectId !== project!.id || draft.publishedAt) return;

    const title = (formData.get("title") as string)?.trim();
    const summary = (formData.get("summary") as string)?.trim() || null;
    const body = (formData.get("body") as string)?.trim();
    const kind = (formData.get("kind") as string) || "update";
    const publish = formData.get("intent") === "publish";
    if (!title || !body) return;

    if (publish && (await publishedTodayCount(project!.id)) >= 3) return;

    await prisma.announcement.update({
      where: { id },
      data: {
        title, summary, body,
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
        <form
          action={editingDraft ? updateAnnouncement : createAnnouncement}
          className={`mb-8 rounded-lg border bg-paper p-5 space-y-3 ${editingDraft ? "border-pin-gold/60 shadow-[0_4px_14px_rgba(0,0,0,.1)]" : "border-paper-edge"}`}
        >
          {editingDraft && <input type="hidden" name="id" value={editingDraft.id} />}
          <p className="font-mono text-xs uppercase tracking-widest text-ink-soft">
            {editingDraft ? "Edit draft" : "Post an update"}
          </p>
          <input
            name="title" required maxLength={120}
            defaultValue={editingDraft?.title ?? ""}
            placeholder="Announcement title"
            className="w-full rounded-md border border-paper-edge bg-paper-bright px-3 py-2 font-sans text-sm text-ink placeholder:text-ink-soft focus:outline-2 focus:outline-pin-gold"
          />
          <input
            name="summary" maxLength={280}
            defaultValue={editingDraft?.summary ?? ""}
            placeholder="Short description (optional — shown in previews & on the board)"
            className="w-full rounded-md border border-paper-edge bg-paper-bright px-3 py-2 font-sans text-sm text-ink placeholder:text-ink-soft focus:outline-2 focus:outline-pin-gold"
          />
          <div className="flex gap-2">
            <select name="kind" defaultValue={editingDraft?.kind ?? "update"} className="rounded-md border border-paper-edge bg-paper-bright px-3 py-2 font-mono text-sm text-ink focus:outline-2 focus:outline-pin-gold">
              <option value="update">Update</option>
              <option value="release">Release</option>
              <option value="roles_open">Roles open</option>
              <option value="milestone">Milestone</option>
            </select>
          </div>
          <MarkdownEditor
            key={editingDraft?.id ?? "new"}
            name="body"
            required
            rows={editingDraft ? 6 : 4}
            maxLength={5000}
            defaultValue={editingDraft?.body ?? ""}
            placeholder="What's new?"
          />
          <p className="font-mono text-[0.65rem] text-ink-soft">Markdown supported · the full post gets its own shareable page</p>
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
            {editingDraft && (
              <Link
                href={`/p/${slug}/announcements`}
                className="ml-auto rounded-md px-3 py-2 font-mono text-sm text-ink-soft hover:text-ink"
              >
                Cancel
              </Link>
            )}
          </div>
        </form>
      )}

      {/* Drafts — only shown to people who can post. The one being edited
          lives in the form above, so it's excluded here. */}
      {canPost && drafts.filter((a) => a.id !== editingDraft?.id).length > 0 && (
        <div className="mb-8">
          <p className="mb-2 font-mono text-[0.65rem] uppercase tracking-widest text-ink-soft">Drafts</p>
          <div className="space-y-3">
            {drafts.filter((a) => a.id !== editingDraft?.id).map((a) => (
              <div key={a.id} className="rounded-lg border border-dashed border-pin-gold/50 bg-[#fffaf0] p-5">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-ink">{a.title}</span>
                  <span className="rounded-full bg-paper-edge px-2 py-0.5 font-mono text-[0.6rem] text-ink-soft">
                    {KIND_LABELS[a.kind] ?? a.kind}
                  </span>
                  <span className="rounded-full bg-[#fff8e1] px-2 py-0.5 font-mono text-[0.6rem] text-pin-gold">draft</span>
                </div>
                <p className="mb-3 text-sm text-ink/80">{summaryOf(a)}</p>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/p/${slug}/announcements?edit=${a.id}`}
                    className="rounded-md border border-paper-edge px-3 py-1.5 font-mono text-xs text-ink-soft hover:border-ink-soft hover:text-ink"
                  >
                    Edit
                  </Link>
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
            <Link
              key={a.id}
              href={`/p/${slug}/announcements/${a.id}`}
              className="block rounded-lg border border-paper-edge bg-paper p-5 transition-colors hover:border-ink-soft"
            >
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="font-semibold text-sm text-ink">{a.title}</span>
                <span className="rounded-full bg-paper-edge px-2 py-0.5 font-mono text-[0.6rem] text-ink-soft">
                  {KIND_LABELS[a.kind] ?? a.kind}
                </span>
                {a.moderationStatus === "held" && (
                  <span className="rounded-full bg-[#fff8e1] px-2 py-0.5 font-mono text-[0.6rem] text-pin-gold">held</span>
                )}
              </div>
              <p className="text-sm text-ink/80 mb-2">{summaryOf(a)}</p>
              <p className="font-mono text-xs text-ink-soft">
                {a.author?.displayName ?? a.author?.githubLogin} · {a.publishedAt ? new Date(a.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "draft"} · read →
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
