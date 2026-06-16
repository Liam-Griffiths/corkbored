import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Header } from "@/components/Header";
import { ProjectTabs } from "@/components/ProjectTabs";
import { FollowButton } from "@/components/FollowButton";
import { ShareButtons } from "@/components/ShareButtons";
import { EditProjectModal } from "@/components/EditProjectModal";
import { LinkedText } from "@/components/SafeLink";
import { getOrCreateProjectShortlink } from "@/lib/shortlink";

const CHAT_ENABLED = process.env.CHAT_ENABLED === "true";

const STAGE_COLORS: Record<string, string> = {
  launched: "bg-pin-red text-white",
  prototype: "bg-pin-gold text-ink",
  building: "bg-pin-teal text-white",
};

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [project, session] = await Promise.all([
    prisma.project.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        title: true,
        stage: true,
        pitch: true,
        moderationStatus: true,
        repoFullName: true,
        tags: { where: { tag: { status: "active" } }, include: { tag: true } },
        _count: { select: { projectFollows: true } },
      },
    }),
    auth(),
  ]);

  if (!project || project.moderationStatus === "removed") notFound();

  const userId = session?.user?.id;

  const membership = userId
    ? await prisma.membership.findUnique({
        where: { projectId_userId: { projectId: project.id, userId } },
        select: { role: true, leftAt: true },
      })
    : null;

  const memberRole = membership && !membership.leftAt ? (membership.role as string) : null;
  const isManager = memberRole === "owner" || memberRole === "maintainer";
  const isOwner = memberRole === "owner";

  const [pendingCount, isFollowing, shortCode] = await Promise.all([
    isManager
      ? prisma.application.count({ where: { role: { projectId: project.id }, status: "pending" } })
      : Promise.resolve(0),
    userId && !isOwner
      ? prisma.projectFollow
          .findUnique({ where: { userId_projectId: { userId, projectId: project.id } } })
          .then((f) => !!f)
      : Promise.resolve(false),
    getOrCreateProjectShortlink(project.id),
  ]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://corkbored.com";

  return (
    <>
      <Header />
      <div className="mx-auto max-w-5xl px-5">
        {/* Masthead */}
        <div className="pt-8 pb-5">
          <Link
            href="/board"
            className="mb-4 inline-block font-mono text-[0.78rem] text-ink-soft hover:text-ink"
          >
            ← back to the board
          </Link>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <span
                  className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full bg-pin-red shadow-[inset_-2px_-2px_3px_rgba(0,0,0,.35)]"
                  aria-hidden="true"
                />
                <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
                  {project.title}
                </h1>
                <span
                  className={`rounded-sm px-2 py-0.5 align-middle font-mono text-[0.6rem] uppercase tracking-wide ${STAGE_COLORS[project.stage] ?? ""}`}
                >
                  {project.stage}
                </span>
                {isOwner && (
                  <EditProjectModal
                    slug={slug}
                    initialTitle={project.title}
                    initialPitch={project.pitch ?? ""}
                    initialStage={project.stage as "building" | "prototype" | "launched"}
                    initialTags={project.tags.map((t) => t.tag.label)}
                  />
                )}
              </div>
              <a
                href={`https://github.com/${project.repoFullName}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-block font-mono text-[0.78rem] text-ink-soft hover:text-ink"
              >
                github.com/{project.repoFullName}
              </a>
            </div>

            <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
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

          {project.pitch && (
            <p className="mt-3 max-w-2xl text-[0.98rem] leading-relaxed text-ink/85">
              <LinkedText text={project.pitch} />
            </p>
          )}

          {project.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {project.tags.map((t) => (
                <span key={t.tag.slug} className="rounded-sm bg-paper-edge px-2 py-0.5 font-mono text-[0.68rem] text-ink-soft">
                  {t.tag.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Tab navigation */}
        <ProjectTabs
          slug={slug}
          memberRole={memberRole}
          pendingCount={pendingCount}
          chatEnabled={CHAT_ENABLED}
        />

        {/* Section content */}
        <div className="py-8">{children}</div>
      </div>
    </>
  );
}
