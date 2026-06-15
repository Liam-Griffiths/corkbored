import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { LinkedText } from "@/components/SafeLink";

const KIND_LABELS: Record<string, string> = {
  update: "Update", release: "Release", roles_open: "Roles open", milestone: "Milestone",
};

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
  const canPost = membership && !membership.leftAt &&
    ["owner", "maintainer"].includes(membership.role as string);

  const announcements = await prisma.announcement.findMany({
    where: { projectId: project.id, moderationStatus: { not: "removed" } },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { displayName: true, githubLogin: true } } },
  });

  async function postAnnouncement(formData: FormData) {
    "use server";
    const s = await auth();
    if (!s?.user?.id) return;

    const projectId = formData.get("projectId") as string;
    const title = (formData.get("title") as string)?.trim();
    const body = (formData.get("body") as string)?.trim();
    const kind = (formData.get("kind") as string) || "update";
    if (!title || !body) return;

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const count = await prisma.announcement.count({ where: { projectId, createdAt: { gte: today } } });
    if (count >= 3) return;

    await prisma.announcement.create({
      data: {
        projectId,
        authorId: s.user.id,
        title, body,
        kind: kind as "update" | "release" | "roles_open" | "milestone",
        publishedAt: new Date(),
      },
    });
    redirect(`/p/${slug}/announcements`);
  }

  return (
    <div className="max-w-2xl px-8 py-8">
      <h1 className="font-display font-bold text-xl text-ink mb-6">Announcements</h1>

      {canPost && (
        <form action={postAnnouncement} className="mb-8 rounded-lg border border-paper-edge bg-paper p-5 space-y-3">
          <input type="hidden" name="projectId" value={project.id} />
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
          <button type="submit" className="rounded-md bg-pin-teal px-4 py-2 font-mono text-sm text-white shadow-[0_2px_0_#0e5a47] hover:-translate-y-px">
            Publish
          </button>
        </form>
      )}

      {announcements.length === 0 ? (
        <p className="rounded-lg border border-dashed border-paper-edge p-10 text-center font-mono text-sm text-ink-soft">
          No announcements yet.
        </p>
      ) : (
        <div className="space-y-4">
          {announcements.map((a) => (
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
