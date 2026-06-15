import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Header } from "@/components/Header";
import { KanbanBoard } from "@/components/KanbanBoard";
import { DiscussionThread } from "@/components/DiscussionThread";
import { LinkedText } from "@/components/SafeLink";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}

type Tab = "apps" | "team" | "roles" | "tasks" | "discussion" | "announcements" | "activity";

async function getProject(slug: string) {
  const project = await prisma.project.findUnique({
    where: { slug },
    include: {
      tags: true,
      roles: { orderBy: { createdAt: "asc" } },
      memberships: {
        where: { leftAt: null },
        include: {
          user: { select: { id: true, displayName: true, githubLogin: true, avatarUrl: true } },
        },
        orderBy: { joinedAt: "asc" },
      },
    },
  });
  if (!project) return null;

  const [applications, announcements, contributions, tasks, messages] = await Promise.all([
    prisma.application.findMany({
      where: { role: { projectId: project.id } },
      orderBy: { createdAt: "desc" },
      include: {
        applicant: { select: { id: true, displayName: true, githubLogin: true } },
        role: { select: { id: true, title: true, projectId: true } },
      },
    }),
    prisma.announcement.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { author: { select: { displayName: true, githubLogin: true } } },
    }),
    prisma.contributionEvent.findMany({
      where: { projectId: project.id },
      orderBy: { occurredAt: "desc" },
      take: 50,
      include: { user: { select: { displayName: true, githubLogin: true } } },
    }),
    prisma.task.findMany({
      where: { projectId: project.id },
      orderBy: { position: "asc" },
      include: { assignee: { select: { id: true, displayName: true, githubLogin: true } } },
    }),
    prisma.message.findMany({
      where: { projectId: project.id, parentId: null, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { id: true, displayName: true, githubLogin: true } },
        replies: {
          where: { deletedAt: null },
          orderBy: { createdAt: "asc" },
          include: { author: { select: { id: true, displayName: true, githubLogin: true } } },
        },
      },
    }),
  ]);

  return { ...project, applications, announcements, contributions, tasks, messages };
}

type Project = NonNullable<Awaited<ReturnType<typeof getProject>>>;

export default async function DashboardPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { tab = "apps" } = await searchParams;
  const session = await auth();

  if (!session?.user?.id) redirect(`/api/auth/signin?callbackUrl=/p/${slug}/dashboard`);

  const project = await getProject(slug);
  if (!project || project.moderationStatus === "removed") notFound();

  const myMembership = project.memberships.find((m) => m.userId === session.user.id);
  if (!myMembership || !["owner", "maintainer"].includes(myMembership.role as string)) {
    redirect(`/p/${slug}`);
  }

  const isOwner = (myMembership.role as string) === "owner";
  const pendingCount = project.applications.filter((a) => a.status === "pending").length;

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "apps", label: "Applications", badge: pendingCount || undefined },
    { id: "roles", label: "Open roles" },
    { id: "team", label: "Team" },
    { id: "tasks", label: "Tasks" },
    { id: "discussion", label: "Discussion" },
    { id: "announcements", label: "Announcements" },
    { id: "activity", label: "Activity" },
  ];

  return (
    <>
      <Header />
      <main className="mx-auto max-w-4xl px-5 py-8">
        <Link href={`/p/${slug}`} className="mb-4 inline-block font-mono text-sm text-ink-soft hover:text-ink">
          ← back to project
        </Link>

        <h1 className="font-display font-bold text-2xl text-ink mb-1">
          {project.title}
          <span className={`ml-3 rounded-sm px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-wide text-white align-middle ${
            project.stage === "launched" ? "bg-pin-red" :
            project.stage === "prototype" ? "bg-pin-gold text-ink" : "bg-pin-teal"
          }`}>
            {project.stage}
          </span>
        </h1>
        <p className="font-mono text-sm text-ink-soft mb-6">
          github.com/{project.repoFullName} · your project dashboard
        </p>

        <div className="rounded-sm bg-paper shadow-[0_14px_30px_rgba(0,0,0,.18)] p-6">
          <div className="flex flex-wrap gap-1 border-b border-paper-edge mb-6 -mx-1 px-1">
            {tabs.map((t) => (
              <Link
                key={t.id}
                href={`/p/${slug}/dashboard?tab=${t.id}`}
                className={`px-3.5 py-2.5 font-mono text-[0.8rem] border-b-2 -mb-px transition-colors ${
                  tab === t.id ? "border-pin-red text-ink font-medium" : "border-transparent text-ink-soft hover:text-ink"
                }`}
              >
                {t.label}
                {t.badge ? (
                  <span className="ml-1.5 inline-flex min-w-[1.125rem] items-center justify-center rounded-full bg-pin-red px-1 py-0.5 font-mono text-[0.64rem] text-white">
                    {t.badge}
                  </span>
                ) : null}
              </Link>
            ))}
          </div>

          {tab === "apps" && <ApplicationsTab project={project} slug={slug} isOwner={isOwner} />}
          {tab === "roles" && <RolesTab project={project} slug={slug} isOwner={isOwner} />}
          {tab === "team" && (
            <TeamTab project={project} currentUserId={session.user.id} isOwner={isOwner} />
          )}
          {tab === "announcements" && (
            <AnnouncementsTab project={project} slug={slug} />
          )}
          {tab === "activity" && <ActivityTab project={project} />}
          {tab === "tasks" && (
            <KanbanBoard
              initialTasks={project.tasks.map((t) => ({
                ...t,
                status: t.status as "todo" | "doing" | "done",
                assignee: t.assignee,
              }))}
              members={project.memberships
                .map((m) => m.user)
                .filter((u): u is NonNullable<typeof u> => u != null)}
              projectSlug={slug}
            />
          )}
          {tab === "discussion" && (
            <DiscussionThread
              initialMessages={project.messages as Parameters<typeof DiscussionThread>[0]["initialMessages"]}
              currentUserId={session.user.id}
              projectSlug={slug}
            />
          )}
        </div>
      </main>
    </>
  );
}

// ── Applications tab ──────────────────────────────────────────────────────────

function ApplicationsTab({ project, slug, isOwner }: { project: Project; slug: string; isOwner: boolean }) {
  if (project.applications.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-paper-edge p-8 text-center font-mono text-sm text-ink-soft">
        No applications yet. Share your project link.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {project.applications.map((app) => {
        const stats = app.githubStatsCache as Record<string, unknown> | null;
        const inviteFailed = app.githubInviteStatus === "failed";
        return (
          <div key={app.id} className="rounded-lg border border-paper-edge bg-paper-bright p-4">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-pin-gold text-xs font-semibold text-ink">
                {(app.applicant.displayName ?? app.applicant.githubLogin ?? "?")[0].toUpperCase()}
              </span>
              <span className="font-semibold text-sm text-ink">
                {app.applicant.displayName ?? app.applicant.githubLogin}
              </span>
              <span className="font-mono text-xs text-ink-soft">
                @{app.applicant.githubLogin} → {app.role.title}
              </span>
              {app.status !== "pending" && (
                <span className={`ml-auto rounded-full px-3 py-0.5 font-mono text-xs ${
                  app.status === "accepted" ? "bg-[#d9efe6] text-pin-teal" : "bg-[#f4ded9] text-pin-red"
                }`}>
                  {app.status}
                </span>
              )}
            </div>

            {stats && (
              <div className="flex flex-wrap gap-4 font-mono text-xs text-ink-soft mb-3">
                {stats.accountAgeYears != null && (
                  <span>account <strong className="text-ink">{Number(stats.accountAgeYears).toFixed(0)} yrs</strong></span>
                )}
                {stats.publicRepos != null && (
                  <span>repos <strong className="text-ink">{String(stats.publicRepos)}</strong></span>
                )}
                {stats.commitsLast90d != null && (
                  <span>commits/90d <strong className="text-ink">{String(stats.commitsLast90d)}</strong></span>
                )}
                {stats.topLanguages != null && (
                  <span><strong className="text-ink">{String(stats.topLanguages)}</strong></span>
                )}
              </div>
            )}

            <blockquote className="mb-3 border-l-4 border-pin-gold pl-3 text-sm text-ink/80 italic">
              <LinkedText text={app.pitch} />
            </blockquote>

            {inviteFailed && app.status === "accepted" && (
              <div className="mb-3 rounded-md bg-[#fff8e1] border border-pin-gold/40 px-3 py-2 font-mono text-xs text-ink">
                ⚠ GitHub invite failed — invite{" "}
                <a href={`https://github.com/${app.applicant.githubLogin}`} target="_blank" rel="noreferrer" className="underline">
                  @{app.applicant.githubLogin}
                </a>{" "}
                manually, then they&apos;re on the record.
              </div>
            )}

            {isOwner && app.status === "pending" && (
              <div className="flex gap-2 mt-1">
                <DecideForm applicationId={app.id} projectId={app.role.projectId} applicantId={app.applicant.id} slug={slug} decision="accepted" />
                <DecideForm applicationId={app.id} projectId={app.role.projectId} applicantId={app.applicant.id} slug={slug} decision="declined" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DecideForm({
  applicationId,
  projectId,
  applicantId,
  slug,
  decision,
}: {
  applicationId: string;
  projectId: string;
  applicantId: string;
  slug: string;
  decision: "accepted" | "declined";
}) {
  async function decideAction() {
    "use server";
    const session = await auth();
    if (!session?.user?.id) return;

    await prisma.$transaction(async (tx) => {
      await tx.application.update({ where: { id: applicationId }, data: { status: decision } });

      if (decision === "accepted") {
        await tx.membership.upsert({
          where: { projectId_userId: { projectId, userId: applicantId } },
          update: { leftAt: null },
          create: { projectId, userId: applicantId, role: "member" },
        });
      }

      await tx.notification.create({
        data: { userId: applicantId, kind: "application_decided", projectId, applicationId },
      });
    });

    redirect(`/p/${slug}/dashboard?tab=apps`);
  }

  return (
    <form action={decideAction}>
      <button
        type="submit"
        className={`rounded-md px-4 py-1.5 font-mono text-xs font-medium shadow-sm transition-transform hover:-translate-y-px ${
          decision === "accepted"
            ? "bg-pin-teal text-white shadow-[0_2px_0_#0e5a47]"
            : "border border-paper-edge text-ink-soft hover:border-ink-soft"
        }`}
      >
        {decision === "accepted" ? "Accept & invite to repo" : "Decline"}
      </button>
    </form>
  );
}

// ── Roles tab ─────────────────────────────────────────────────────────────────

function RolesTab({ project, slug, isOwner }: { project: Project; slug: string; isOwner: boolean }) {
  const openCount = project.roles.filter((r) => r.status === "open").length;

  return (
    <div>
      <div className="space-y-3 mb-6">
        {project.roles.length === 0 ? (
          <p className="rounded-lg border border-dashed border-paper-edge p-6 text-center font-mono text-sm text-ink-soft">
            No roles yet.
          </p>
        ) : (
          project.roles.map((role) => (
            <div key={role.id} className="flex items-center justify-between gap-3 rounded-lg border border-paper-edge bg-paper-bright p-4">
              <div>
                <p className="font-semibold text-sm text-ink">{role.title}</p>
                {role.detail && <p className="text-xs text-ink-soft">{role.detail}</p>}
              </div>
              <span className={`font-mono text-xs px-2 py-0.5 rounded-full ${
                role.status === "open" ? "bg-[#d9efe6] text-pin-teal" : "bg-paper-edge text-ink-soft"
              }`}>
                {role.status}
              </span>
            </div>
          ))
        )}
      </div>
      {isOwner && openCount < 5 && <AddRoleForm slug={slug} projectId={project.id} />}
      {isOwner && openCount >= 5 && (
        <p className="font-mono text-xs text-ink-soft">Maximum 5 open roles reached.</p>
      )}
    </div>
  );
}

function AddRoleForm({ slug, projectId }: { slug: string; projectId: string }) {
  async function addRole(formData: FormData) {
    "use server";
    const title = (formData.get("title") as string)?.trim();
    const detail = (formData.get("detail") as string)?.trim();
    if (!title) return;

    const openCount = await prisma.role.count({ where: { projectId, status: "open" } });
    if (openCount >= 5) return;

    await prisma.role.create({ data: { projectId, title, detail: detail || undefined } });
    redirect(`/p/${slug}/dashboard?tab=roles`);
  }

  return (
    <form action={addRole} className="rounded-lg border border-paper-edge p-4">
      <p className="mb-3 font-mono text-xs uppercase tracking-widest text-ink-soft">Add a role</p>
      <div className="flex flex-col gap-2">
        <input
          name="title"
          required
          placeholder="Role title"
          className="w-full rounded-md border border-paper-edge bg-paper px-3 py-2 font-sans text-sm text-ink placeholder:text-ink-soft focus:outline-2 focus:outline-pin-gold"
        />
        <input
          name="detail"
          placeholder="Details — commitment, focus area (optional)"
          className="w-full rounded-md border border-paper-edge bg-paper px-3 py-2 font-sans text-sm text-ink placeholder:text-ink-soft focus:outline-2 focus:outline-pin-gold"
        />
        <button type="submit" className="self-start rounded-md bg-pin-red px-4 py-2 font-mono text-sm text-white shadow-[0_2px_0_#7c2d14] hover:-translate-y-px">
          + Add role
        </button>
      </div>
    </form>
  );
}

// ── Team tab ──────────────────────────────────────────────────────────────────

function TeamTab({ project, currentUserId, isOwner }: { project: Project; currentUserId: string; isOwner: boolean }) {
  return (
    <div>
      <div className="divide-y divide-dashed divide-paper-edge mb-4">
        {project.memberships.map((m) => (
          <div key={m.id} className="flex items-center gap-3 py-3 text-sm">
            <span className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-pin-gold text-xs font-semibold text-ink">
              {(m.user?.displayName ?? m.user?.githubLogin ?? "?")[0].toUpperCase()}
            </span>
            <div className="flex-1">
              <p className="font-medium text-ink">{m.user?.displayName ?? m.user?.githubLogin}</p>
              <p className="font-mono text-xs text-ink-soft">@{m.user?.githubLogin} · joined on record</p>
            </div>
            {(m.role as string) === "owner" ? (
              <span className="rounded-sm bg-ink px-1.5 py-0.5 font-mono text-[0.62rem] text-paper">owner</span>
            ) : isOwner && m.userId !== currentUserId ? (
              <RemoveMemberForm membershipId={m.id} login={m.user?.githubLogin ?? ""} slug={project.slug} />
            ) : null}
          </div>
        ))}
      </div>
      <p className="font-mono text-xs text-ink-soft">
        Every join and leave is timestamped — this record backs the contribution agreement later.
      </p>
    </div>
  );
}

function RemoveMemberForm({ membershipId, login, slug }: { membershipId: string; login: string; slug: string }) {
  async function removeMember() {
    "use server";
    const session = await auth();
    if (!session?.user?.id) return;
    await prisma.membership.update({
      where: { id: membershipId },
      data: { leftAt: new Date(), removedById: session.user.id },
    });
    redirect(`/p/${slug}/dashboard?tab=team`);
  }

  return (
    <form action={removeMember}>
      <button type="submit" className="rounded-md border border-paper-edge px-3 py-1 font-mono text-xs text-ink-soft hover:border-ink-soft" aria-label={`Remove @${login}`}>
        Remove
      </button>
    </form>
  );
}

// ── Announcements tab ─────────────────────────────────────────────────────────

const KIND_LABELS: Record<string, string> = {
  update: "Update", release: "Release", roles_open: "Roles open", milestone: "Milestone",
};

function AnnouncementsTab({ project, slug }: { project: Project; slug: string }) {
  return (
    <div>
      <PostAnnouncementForm projectId={project.id} slug={slug} />
      <div className="mt-6 space-y-4">
        {project.announcements.length === 0 ? (
          <p className="rounded-lg border border-dashed border-paper-edge p-6 text-center font-mono text-sm text-ink-soft">
            No announcements yet.
          </p>
        ) : (
          project.announcements.map((a) => (
            <div key={a.id} className="rounded-lg border border-paper-edge bg-paper-bright p-4">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-semibold text-sm text-ink">{a.title}</span>
                <span className="rounded-full bg-board px-2 py-0.5 font-mono text-xs text-ink-soft">
                  {KIND_LABELS[a.kind] ?? a.kind}
                </span>
                {a.moderationStatus === "held" && (
                  <span className="rounded-full bg-[#fff8e1] px-2 py-0.5 font-mono text-xs text-pin-gold">held</span>
                )}
              </div>
              <p className="text-sm text-ink/80 mb-1"><LinkedText text={a.body} /></p>
              <p className="font-mono text-xs text-ink-soft">
                by {a.author?.displayName ?? a.author?.githubLogin} · {a.publishedAt ? new Date(a.publishedAt).toLocaleDateString() : "draft"}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function PostAnnouncementForm({ projectId, slug }: { projectId: string; slug: string }) {
  async function postAnnouncement(formData: FormData) {
    "use server";
    const { auth: getAuth } = await import("@/lib/auth");
    const session = await getAuth();
    if (!session?.user?.id) return;

    const title = (formData.get("title") as string)?.trim();
    const body = (formData.get("body") as string)?.trim();
    const kind = (formData.get("kind") as string) || "update";
    if (!title || !body) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const count = await prisma.announcement.count({ where: { projectId, createdAt: { gte: today } } });
    if (count >= 3) return;

    await prisma.announcement.create({
      data: { projectId, authorId: session.user.id, title, body, kind: kind as "update" | "release" | "roles_open" | "milestone", publishedAt: new Date() },
    });

    const { redirect } = await import("next/navigation");
    redirect(`/p/${slug}/dashboard?tab=announcements`);
  }

  return (
    <form action={postAnnouncement} className="rounded-lg border border-paper-edge p-4">
      <p className="mb-3 font-mono text-xs uppercase tracking-widest text-ink-soft">Post an announcement</p>
      <div className="flex flex-col gap-2">
        <input
          name="title"
          required
          placeholder="Announcement title"
          maxLength={120}
          className="w-full rounded-md border border-paper-edge bg-paper px-3 py-2 font-sans text-sm text-ink placeholder:text-ink-soft focus:outline-2 focus:outline-pin-gold"
        />
        <select
          name="kind"
          className="rounded-md border border-paper-edge bg-paper px-3 py-2 font-mono text-sm text-ink focus:outline-2 focus:outline-pin-gold"
        >
          <option value="update">Update</option>
          <option value="release">Release</option>
          <option value="roles_open">Roles open</option>
          <option value="milestone">Milestone</option>
        </select>
        <textarea
          name="body"
          required
          placeholder="What's new?"
          rows={3}
          maxLength={5000}
          className="w-full rounded-md border border-paper-edge bg-paper px-3 py-2 font-sans text-sm text-ink placeholder:text-ink-soft focus:outline-2 focus:outline-pin-gold resize-y"
        />
        <button type="submit" className="self-start rounded-md bg-pin-teal px-4 py-2 font-mono text-sm text-white shadow-[0_2px_0_#0e5a47] hover:-translate-y-px">
          Publish
        </button>
      </div>
    </form>
  );
}

// ── Activity tab ──────────────────────────────────────────────────────────────

const EVENT_LABELS: Record<string, string> = {
  commit: "pushed a commit",
  pr_merged: "merged a PR",
  release: "published a release",
  manual: "completed a task",
};

function ActivityTab({ project }: { project: Project }) {
  if (project.contributions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-paper-edge p-8 text-center">
        <p className="font-mono text-sm text-ink-soft">No activity yet.</p>
        <p className="font-mono text-xs text-ink-soft mt-1">
          Activity populates once your GitHub App webhook is configured.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-dashed divide-paper-edge">
      {project.contributions.map((ev) => {
        const meta = ev.metadata as Record<string, unknown> | null;
        return (
          <div key={ev.id} className="flex gap-3 py-3 text-sm">
            <span className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-pin-gold text-xs font-semibold text-ink">
              {(ev.user?.displayName ?? ev.user?.githubLogin ?? "?")[0].toUpperCase()}
            </span>
            <div>
              <span className="font-medium text-ink">{ev.user?.displayName ?? ev.user?.githubLogin}</span>{" "}
              <span className="text-ink-soft">{EVENT_LABELS[ev.kind] ?? ev.kind}</span>
              {!!meta?.message && (
                <p className="font-mono text-xs text-ink-soft mt-0.5 truncate max-w-md">{String(meta.message)}</p>
              )}
              {!!meta?.title && !meta.message && (
                <p className="font-mono text-xs text-ink-soft mt-0.5">{String(meta.title)}</p>
              )}
              <p className="font-mono text-xs text-ink-soft/60 mt-0.5">{new Date(ev.occurredAt).toLocaleString()}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Coming soon ───────────────────────────────────────────────────────────────

const TAB_PHASES: Record<string, string> = {};

function ComingSoon({ tab }: { tab: string }) {
  return (
    <div className="rounded-lg border border-dashed border-paper-edge p-10 text-center">
      <p className="font-mono text-sm text-ink-soft">
        {tab} — coming in {TAB_PHASES[tab] ?? "a later phase"}
      </p>
    </div>
  );
}
