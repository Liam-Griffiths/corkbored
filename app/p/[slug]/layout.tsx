import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Header } from "@/components/Header";
import { ProjectNav } from "@/components/ProjectNav";

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
      select: { id: true, slug: true, title: true, stage: true, moderationStatus: true, repoFullName: true },
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
  const isOwnerOrMaintainer = memberRole === "owner" || memberRole === "maintainer";

  const pendingCount = isOwnerOrMaintainer
    ? await prisma.application.count({
        where: { role: { projectId: project.id }, status: "pending" },
      })
    : 0;

  return (
    <>
      <Header />
      <div className="flex min-h-[calc(100vh-65px)]">
        {/* Sidebar */}
        <aside className="w-52 flex-shrink-0 border-r border-paper-edge bg-paper flex flex-col sticky top-[65px] h-[calc(100vh-65px)]">
          {/* Project identity */}
          <div className="border-b border-paper-edge px-4 py-4">
            <Link href={`/p/${slug}`}>
              <p className="font-display font-semibold text-sm text-ink leading-snug line-clamp-2 hover:text-pin-red transition-colors">
                {project.title}
              </p>
            </Link>
            <div className="mt-1.5 flex items-center gap-2">
              <span className={`rounded-sm px-1.5 py-0.5 font-mono text-[0.58rem] uppercase tracking-wide ${STAGE_COLORS[project.stage]}`}>
                {project.stage}
              </span>
              <a
                href={`https://github.com/${project.repoFullName}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[0.6rem] text-ink-soft hover:text-ink truncate"
              >
                {project.repoFullName}
              </a>
            </div>
          </div>

          <ProjectNav
            slug={slug}
            memberRole={memberRole}
            pendingCount={pendingCount}
            chatEnabled={CHAT_ENABLED}
          />

          {/* Footer */}
          <div className="border-t border-paper-edge px-4 py-3">
            <Link href="/board" className="font-mono text-[0.68rem] text-ink-soft hover:text-ink transition-colors">
              ← board
            </Link>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </>
  );
}
