import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { LinkedText } from "@/components/SafeLink";
import { FollowButton } from "@/components/FollowButton";
import { ShareButtons } from "@/components/ShareButtons";
import { getOrCreateProjectShortlink } from "@/lib/shortlink";

async function getProject(slug: string) {
  return prisma.project.findUnique({
    where: { slug },
    include: {
      tags: true,
      roles: { where: { status: "open" }, orderBy: { createdAt: "asc" } },
      memberships: {
        where: { leftAt: null },
        orderBy: { joinedAt: "asc" },
        include: { user: { select: { id: true, displayName: true, githubLogin: true, avatarUrl: true } } },
      },
      announcements: {
        where: { moderationStatus: "published", publishedAt: { not: null } },
        orderBy: { publishedAt: "desc" },
        take: 3,
      },
      _count: { select: { projectFollows: true } },
    },
  });
}

export default async function ProjectOverviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [project, session] = await Promise.all([getProject(slug), auth()]);

  if (!project || project.moderationStatus === "removed") notFound();

  const userId = session?.user?.id;
  const membership = userId
    ? project.memberships.find((m) => m.userId === userId)
    : null;
  const isMember = !!membership;
  const isOwner = membership?.role === "owner";

  const [isFollowing, shortCode] = await Promise.all([
    userId && !isOwner
      ? prisma.projectFollow.findUnique({
          where: { userId_projectId: { userId, projectId: project.id } },
        }).then((f) => !!f)
      : Promise.resolve(false),
    getOrCreateProjectShortlink(project.id),
  ]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://corkbored.com";
  const KIND_LABELS: Record<string, string> = {
    update: "update", release: "release", roles_open: "roles open", milestone: "milestone",
  };

  return (
    <div className="max-w-3xl px-8 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start gap-4">
        <div className="flex-1 min-w-0">
          {project.pitch ? (
            <p className="text-[1.05rem] text-ink/85 leading-relaxed max-w-2xl">
              <LinkedText text={project.pitch} />
            </p>
          ) : (
            <p className="text-sm text-ink-soft italic">No pitch yet.</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
          <ShareButtons shortUrl={`${appUrl}/${shortCode}`} title={project.title} />
          {userId && !isOwner && (
            <FollowButton
              endpoint={`/api/projects/${slug}/follow`}
              initialFollowing={isFollowing}
              initialCount={project._count.projectFollows}
            />
          )}
        </div>
      </div>

      {/* Tags */}
      {project.tags.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-1.5">
          {project.tags.map((t) => (
            <span key={t.tag} className="rounded-sm bg-paper-edge px-2 py-0.5 font-mono text-xs text-ink-soft">
              {t.tag}
            </span>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="mb-8 flex flex-wrap gap-6 border-b border-paper-edge pb-6">
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
          <div className="flex items-center justify-between mb-3">
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
                    <p className="font-medium text-sm text-ink truncate">{role.title}</p>
                    {role.detail && <p className="text-xs text-ink-soft truncate">{role.detail}</p>}
                  </div>
                  {isOwner ? (
                    <span className="font-mono text-xs text-ink-soft flex-shrink-0">your project</span>
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
          <div className="flex items-center justify-between mb-3">
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
                  <div className="flex-1 min-w-0">
                    {login ? (
                      <Link href={`/u/${login}`} className="font-medium text-sm text-ink hover:underline truncate block">
                        {name}
                      </Link>
                    ) : (
                      <p className="font-medium text-sm text-ink truncate">{name}</p>
                    )}
                  </div>
                  {(m.role as string) === "owner" && (
                    <span className="rounded-sm bg-ink px-1.5 py-0.5 font-mono text-[0.58rem] text-paper flex-shrink-0">owner</span>
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
        <section className="mt-8 pt-8 border-t border-paper-edge">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-mono text-xs uppercase tracking-widest text-ink-soft">Latest announcements</h2>
            <Link href={`/p/${slug}/announcements`} className="font-mono text-[0.68rem] text-ink-soft hover:text-ink">all →</Link>
          </div>
          <div className="space-y-3">
            {project.announcements.map((a) => (
              <div key={a.id} className="rounded-lg border border-paper-edge bg-paper p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm text-ink">{a.title}</span>
                  <span className="rounded-full bg-paper-edge px-2 py-0.5 font-mono text-[0.6rem] text-ink-soft">
                    {KIND_LABELS[a.kind] ?? a.kind}
                  </span>
                </div>
                <p className="text-sm text-ink/75 line-clamp-2"><LinkedText text={a.body} /></p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Member quick-links */}
      {isMember && (
        <div className="mt-8 pt-6 border-t border-paper-edge">
          <p className="font-mono text-[0.65rem] uppercase tracking-widest text-ink-soft mb-3">Quick links</p>
          <div className="flex flex-wrap gap-2">
            <Link href={`/p/${slug}/tasks`} className="rounded-md border border-paper-edge px-3 py-1.5 font-mono text-xs text-ink-soft hover:border-ink-soft hover:text-ink">
              ✓ Tasks
            </Link>
            <Link href={`/p/${slug}/discussion`} className="rounded-md border border-paper-edge px-3 py-1.5 font-mono text-xs text-ink-soft hover:border-ink-soft hover:text-ink">
              💬 Discussion
            </Link>
            <Link href={`/p/${slug}/chat`} className="rounded-md border border-pin-teal/30 px-3 py-1.5 font-mono text-xs text-pin-teal hover:border-pin-teal">
              ⚡ Team chat
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
