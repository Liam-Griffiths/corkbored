import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Header } from "@/components/Header";

interface Props {
  params: Promise<{ slug: string }>;
}

async function getProject(slug: string) {
  return prisma.project.findUnique({
    where: { slug },
    include: {
      tags: true,
      roles: { where: { status: "open" } },
      memberships: {
        where: { leftAt: null },
        include: { user: { select: { id: true, displayName: true, githubLogin: true, avatarUrl: true } } },
      },
      announcements: {
        where: { moderationStatus: "published", publishedAt: { not: null } },
        orderBy: { publishedAt: "desc" },
        take: 5,
      },
    },
  });
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const [project, session] = await Promise.all([getProject(slug), auth()]);

  if (!project || project.moderationStatus === "removed") notFound();

  const userId = session?.user?.id;
  const isOwner = userId
    ? project.memberships.some((m) => m.userId === userId && m.user && (m as { role?: string }).role === "owner")
    : false;

  const myApplicationRoleIds = userId
    ? await prisma.application
        .findMany({
          where: { applicantId: userId, role: { projectId: project.id } },
          select: { roleId: true },
        })
        .then((apps) => new Set(apps.map((a) => a.roleId)))
    : new Set<string>();

  return (
    <>
      <Header />
      <main className="mx-auto max-w-4xl px-5 py-10">
        <Link
          href="/board"
          className="mb-6 inline-block font-mono text-sm text-ink-soft hover:text-ink"
        >
          ← back to the board
        </Link>

        <div className="rounded-sm bg-paper shadow-[0_14px_30px_rgba(0,0,0,.18)] p-8">
          {/* Head */}
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-paper-edge pb-5">
            <div>
              <h1 className="font-display font-bold text-2xl text-ink">
                {project.title}
                <span
                  className={`ml-3 rounded-sm px-2 py-0.5 font-mono text-[0.68rem] uppercase tracking-wide text-white align-middle ${
                    project.stage === "launched"
                      ? "bg-pin-red"
                      : project.stage === "prototype"
                        ? "bg-pin-gold text-ink"
                        : "bg-pin-teal"
                  }`}
                >
                  {project.stage}
                </span>
              </h1>
              <p className="mt-1 font-mono text-sm text-ink-soft">
                github.com/{project.repoFullName}
              </p>
            </div>
            {isOwner ? (
              <Link
                href={`/p/${slug}/dashboard`}
                className="rounded-md bg-pin-teal px-4 py-2 font-mono text-sm text-white shadow-[0_2px_0_#0e5a47] hover:-translate-y-px"
              >
                Open dashboard
              </Link>
            ) : null}
          </div>

          {/* Pitch */}
          {project.pitch && (
            <p className="mb-6 max-w-2xl text-[0.97rem] text-ink/80">
              {project.pitch}
            </p>
          )}

          {/* Tags */}
          <div className="mb-6 flex flex-wrap gap-1.5">
            {project.tags.map((t) => (
              <span
                key={t.tag}
                className="rounded-sm bg-paper-edge px-2 py-0.5 font-mono text-xs text-ink-soft"
              >
                {t.tag}
              </span>
            ))}
          </div>

          {/* Announcements */}
          {project.announcements.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-ink-soft">
                Announcements
              </h2>
              <div className="space-y-3">
                {project.announcements.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-lg border border-paper-edge bg-paper-bright p-4"
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-semibold text-sm text-ink">
                        {a.title}
                      </span>
                      <span className="font-mono text-[0.64rem] text-ink-soft">
                        {a.kind.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-sm text-ink/75">{a.body}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Roles + Team */}
          <div className="grid grid-cols-1 gap-8 md:grid-cols-[1.5fr_1fr]">
            <section>
              <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-ink-soft">
                Looking for collaborators
              </h2>
              {project.roles.length === 0 ? (
                <p className="rounded-lg border border-dashed border-paper-edge p-4 text-center font-mono text-sm text-ink-soft">
                  Team is full right now.
                </p>
              ) : (
                <div className="space-y-3">
                  {project.roles.map((role) => (
                    <div
                      key={role.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-paper-edge bg-paper-bright p-4"
                    >
                      <div>
                        <p className="font-semibold text-sm text-ink">
                          {role.title}
                        </p>
                        {role.detail && (
                          <p className="text-xs text-ink-soft">{role.detail}</p>
                        )}
                      </div>
                      {isOwner ? (
                        <span className="font-mono text-xs text-ink-soft">
                          your project
                        </span>
                      ) : myApplicationRoleIds.has(role.id) ? (
                        <span className="rounded-full bg-[#d9efe6] px-3 py-1 font-mono text-xs text-pin-teal">
                          applied ✓
                        </span>
                      ) : userId ? (
                        <Link
                          href={`/p/${slug}/apply/${role.id}`}
                          className="rounded-md bg-pin-red px-3 py-1.5 font-mono text-xs text-white shadow-[0_2px_0_#7c2d14] hover:-translate-y-px"
                        >
                          Apply
                        </Link>
                      ) : (
                        <Link
                          href="/api/auth/signin"
                          className="rounded-md border border-ink/20 px-3 py-1.5 font-mono text-xs text-ink-soft hover:border-ink/40"
                        >
                          Sign in to apply
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-ink-soft">
                Team
              </h2>
              <div className="divide-y divide-dashed divide-paper-edge">
                {project.memberships.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 py-2.5 text-sm"
                  >
                    <span className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-pin-gold text-xs font-semibold text-ink">
                      {(m.user?.displayName ?? m.user?.githubLogin ?? "?")[0].toUpperCase()}
                    </span>
                    <div>
                      <p className="font-medium text-ink">
                        {m.user?.displayName ?? m.user?.githubLogin}
                      </p>
                      <p className="font-mono text-xs text-ink-soft">
                        @{m.user?.githubLogin}
                      </p>
                    </div>
                    {(m as { role?: string }).role === "owner" && (
                      <span className="ml-auto rounded-sm bg-ink px-1.5 py-0.5 font-mono text-[0.62rem] text-paper">
                        owner
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
