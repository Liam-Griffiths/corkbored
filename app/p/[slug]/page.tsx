import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { LinkedText } from "@/components/SafeLink";
import { ChatPanel } from "@/components/ChatPanel";

const CHAT_ENABLED = process.env.CHAT_ENABLED === "true";
const CHAT_TRANSPORT = (process.env.CHAT_TRANSPORT ?? "polling") as "polling" | "websocket";
const CHAT_WS_URL = process.env.CHAT_WS_URL ?? null;

const KIND_LABELS: Record<string, string> = {
  update: "update", release: "release", roles_open: "roles open", milestone: "milestone",
};

const EVENT_LABELS: Record<string, string> = {
  commit: "pushed a commit",
  pr_merged: "merged a PR",
  release: "published a release",
  manual: "completed a task",
};

export default async function ProjectOverviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [project, session] = await Promise.all([
    prisma.project.findUnique({
      where: { slug },
      include: {
        roles: { where: { status: "open" }, orderBy: { createdAt: "asc" } },
        memberships: {
          where: { leftAt: null },
          orderBy: { joinedAt: "asc" },
          include: { user: { select: { id: true, displayName: true, githubLogin: true, avatarUrl: true } } },
        },
        announcements: {
          where: { moderationStatus: "published", publishedAt: { not: null } },
          orderBy: { publishedAt: "desc" },
          take: 4,
        },
        _count: { select: { projectFollows: true } },
      },
    }),
    auth(),
  ]);

  if (!project || project.moderationStatus === "removed") notFound();

  const userId = session?.user?.id;
  const membership = userId ? project.memberships.find((m) => m.userId === userId) : null;
  const isMember = !!membership;
  const isOwner = membership?.role === "owner";

  // ── Member mission control: chat + who's online + activity ──────────────────
  if (isMember && userId) {
    const activity = await prisma.contributionEvent.findMany({
      where: { projectId: project.id },
      orderBy: { occurredAt: "desc" },
      take: 8,
      include: { user: { select: { displayName: true, githubLogin: true } } },
    });

    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* Team chat — includes its own who's-online rail */}
        <section className="min-w-0">
          <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-ink-soft">Team chat</h2>
          {CHAT_ENABLED ? (
            <div className="h-[560px]">
              <ChatPanel
                slug={slug}
                currentUserId={userId}
                transport={CHAT_TRANSPORT}
                wsUrl={CHAT_WS_URL}
                fullHeight
              />
            </div>
          ) : (
            <div className="flex h-[560px] flex-col items-center justify-center rounded-sm border border-dashed border-paper-edge bg-paper p-8 text-center">
              <p className="font-mono text-sm text-ink-soft">Live chat is off for now.</p>
              <Link href={`/p/${slug}/discussion`} className="mt-2 inline-block font-mono text-xs text-pin-teal hover:underline">
                Open the discussion board →
              </Link>
            </div>
          )}
        </section>

        {/* Side column: pulse + activity + announcements.
            mt-7 aligns the top with the chat panel (offsets the left column's
            "Team chat" heading: text-xs line ≈ 1rem + mb-3 0.75rem). */}
        <aside className="space-y-6 lg:mt-7">
          {/* Pulse */}
          <div className="rounded-sm bg-paper p-4 shadow-[0_6px_16px_rgba(0,0,0,.12)]">
            <p className="mb-3 font-mono text-[0.62rem] uppercase tracking-widest text-ink-soft">Pulse</p>
            <div className="flex justify-between gap-2 text-center">
              <Link href={`/p/${slug}/team`} className="flex-1 group">
                <p className="font-mono text-xl font-bold text-ink">{project.memberships.length}</p>
                <p className="font-mono text-[0.6rem] uppercase tracking-wide text-ink-soft group-hover:text-ink">team</p>
              </Link>
              <div className="flex-1">
                <p className="font-mono text-xl font-bold text-ink">{project._count.projectFollows}</p>
                <p className="font-mono text-[0.6rem] uppercase tracking-wide text-ink-soft">followers</p>
              </div>
              <Link href={`/p/${slug}/roles`} className="flex-1 group">
                <p className={`font-mono text-xl font-bold ${project.roles.length > 0 ? "text-pin-red" : "text-ink"}`}>
                  {project.roles.length}
                </p>
                <p className="font-mono text-[0.6rem] uppercase tracking-wide text-ink-soft group-hover:text-ink">open roles</p>
              </Link>
            </div>
          </div>

          {/* Activity */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="font-mono text-[0.62rem] uppercase tracking-widest text-ink-soft">Recent activity</p>
              <Link href={`/p/${slug}/activity`} className="font-mono text-[0.62rem] text-ink-soft hover:text-ink">all →</Link>
            </div>
            {activity.length === 0 ? (
              <p className="rounded-sm border border-dashed border-paper-edge p-4 text-center font-mono text-xs text-ink-soft">
                Quiet so far. Activity shows up once your GitHub webhook fires.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {activity.map((ev) => {
                  const meta = ev.metadata as Record<string, unknown> | null;
                  return (
                    <li key={ev.id} className="flex gap-2 text-xs">
                      <span className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-pin-gold text-[0.6rem] font-semibold text-ink">
                        {(ev.user?.displayName ?? ev.user?.githubLogin ?? "?")[0].toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="text-ink/85">
                          <span className="font-medium text-ink">{ev.user?.displayName ?? ev.user?.githubLogin}</span>{" "}
                          <span className="text-ink-soft">{EVENT_LABELS[ev.kind] ?? ev.kind}</span>
                        </p>
                        {!!meta?.message && <p className="truncate font-mono text-[0.68rem] text-ink-soft">{String(meta.message)}</p>}
                        <p className="font-mono text-[0.6rem] text-ink-soft/60">{new Date(ev.occurredAt).toLocaleDateString()}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Latest announcements */}
          {project.announcements.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="font-mono text-[0.62rem] uppercase tracking-widest text-ink-soft">Announcements</p>
                <Link href={`/p/${slug}/announcements`} className="font-mono text-[0.62rem] text-ink-soft hover:text-ink">all →</Link>
              </div>
              <div className="space-y-2">
                {project.announcements.slice(0, 2).map((a) => (
                  <div key={a.id} className="rounded-sm border border-paper-edge bg-paper p-3">
                    <p className="text-sm font-semibold text-ink">{a.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-ink/70"><LinkedText text={a.body} /></p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    );
  }

  // ── Public face: roles + team + announcements ───────────────────────────────
  return (
    <div className="space-y-8">
      {/* Stats */}
      <div className="flex flex-wrap gap-8 border-b border-paper-edge pb-6">
        <div>
          <p className="font-mono text-2xl font-bold text-ink">{project.memberships.length}</p>
          <p className="font-mono text-[0.68rem] uppercase tracking-widest text-ink-soft">members</p>
        </div>
        <div>
          <p className="font-mono text-2xl font-bold text-ink">{project._count.projectFollows}</p>
          <p className="font-mono text-[0.68rem] uppercase tracking-widest text-ink-soft">followers</p>
        </div>
        <div>
          <p className={`font-mono text-2xl font-bold ${project.roles.length > 0 ? "text-pin-red" : "text-ink"}`}>
            {project.roles.length}
          </p>
          <p className="font-mono text-[0.68rem] uppercase tracking-widest text-ink-soft">open roles</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-[1.4fr_1fr]">
        {/* Open roles */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-mono text-xs uppercase tracking-widest text-ink-soft">Open roles</h2>
            <Link href={`/p/${slug}/roles`} className="font-mono text-[0.68rem] text-ink-soft hover:text-ink">all →</Link>
          </div>
          {project.roles.length === 0 ? (
            <p className="rounded-lg border border-dashed border-paper-edge p-4 text-center font-mono text-sm text-ink-soft">
              No open roles right now.
            </p>
          ) : (
            <div className="space-y-2">
              {project.roles.slice(0, 4).map((role) => (
                <div key={role.id} className="flex items-center justify-between gap-3 rounded-lg border border-paper-edge bg-paper p-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{role.title}</p>
                    {role.detail && <p className="truncate text-xs text-ink-soft">{role.detail}</p>}
                  </div>
                  {isOwner ? (
                    <span className="flex-shrink-0 font-mono text-xs text-ink-soft">your project</span>
                  ) : userId ? (
                    <Link
                      href={`/p/${slug}/apply/${role.id}`}
                      className="flex-shrink-0 rounded-md bg-pin-red px-3 py-1.5 font-mono text-xs text-white shadow-[0_2px_0_#7c2d14] hover:-translate-y-px"
                    >
                      Apply
                    </Link>
                  ) : (
                    <Link
                      href="/api/auth/signin"
                      className="flex-shrink-0 rounded-md border border-paper-edge px-3 py-1.5 font-mono text-xs text-ink-soft hover:border-ink/40"
                    >
                      Sign in
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Team */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-mono text-xs uppercase tracking-widest text-ink-soft">Team</h2>
            <Link href={`/p/${slug}/team`} className="font-mono text-[0.68rem] text-ink-soft hover:text-ink">all →</Link>
          </div>
          <div className="space-y-2">
            {project.memberships.slice(0, 6).map((m) => {
              const name = m.user?.displayName ?? m.user?.githubLogin ?? "?";
              const login = m.user?.githubLogin;
              return (
                <div key={m.id} className="flex items-center gap-2.5">
                  {login ? (
                    <Link href={`/u/${login}`} className="flex-shrink-0">
                      {m.user?.avatarUrl ? (
                        <Image src={m.user.avatarUrl} alt={name} width={28} height={28} className="rounded-full" />
                      ) : (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-pin-gold text-xs font-semibold text-ink">
                          {name[0].toUpperCase()}
                        </span>
                      )}
                    </Link>
                  ) : (
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-pin-gold text-xs font-semibold text-ink">
                      {name[0].toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    {login ? (
                      <Link href={`/u/${login}`} className="block truncate text-sm font-medium text-ink hover:underline">
                        {name}
                      </Link>
                    ) : (
                      <p className="truncate text-sm font-medium text-ink">{name}</p>
                    )}
                  </div>
                  {(m.role as string) === "owner" && (
                    <span className="flex-shrink-0 rounded-sm bg-ink px-1.5 py-0.5 font-mono text-[0.58rem] text-paper">owner</span>
                  )}
                </div>
              );
            })}
            {project.memberships.length > 6 && (
              <Link href={`/p/${slug}/team`} className="font-mono text-xs text-ink-soft hover:text-ink">
                +{project.memberships.length - 6} more
              </Link>
            )}
          </div>
        </section>
      </div>

      {/* Recent announcements */}
      {project.announcements.length > 0 && (
        <section className="border-t border-paper-edge pt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-mono text-xs uppercase tracking-widest text-ink-soft">Latest announcements</h2>
            <Link href={`/p/${slug}/announcements`} className="font-mono text-[0.68rem] text-ink-soft hover:text-ink">all →</Link>
          </div>
          <div className="space-y-3">
            {project.announcements.slice(0, 3).map((a) => (
              <div key={a.id} className="rounded-lg border border-paper-edge bg-paper p-4">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink">{a.title}</span>
                  <span className="rounded-full bg-paper-edge px-2 py-0.5 font-mono text-[0.6rem] text-ink-soft">
                    {KIND_LABELS[a.kind] ?? a.kind}
                  </span>
                </div>
                <p className="line-clamp-2 text-sm text-ink/75"><LinkedText text={a.body} /></p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
