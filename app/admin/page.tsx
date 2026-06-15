import { prisma } from "@/lib/db";
import Link from "next/link";

export default async function AdminOverviewPage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    totalUsers,
    newUsersToday,
    totalProjects,
    newProjectsToday,
    totalApplications,
    applicationsToday,
    moderationPending,
    reportsPending,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: today } } }),
    prisma.project.count({ where: { moderationStatus: { not: "removed" } } }),
    prisma.project.count({ where: { createdAt: { gte: today }, moderationStatus: { not: "removed" } } }),
    prisma.application.count(),
    prisma.application.count({ where: { createdAt: { gte: today } } }),
    prisma.moderationItem.count({ where: { decidedAt: null } }),
    prisma.report.count(),
  ]);

  const recentSignups = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { id: true, githubLogin: true, displayName: true, avatarUrl: true, createdAt: true },
  });

  const recentProjects = await prisma.project.findMany({
    where: { moderationStatus: { not: "removed" } },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { id: true, slug: true, title: true, stage: true, createdAt: true, owner: { select: { githubLogin: true } } },
  });

  const stats = [
    { label: "Total users", value: totalUsers, sub: `+${newUsersToday} today`, href: "/admin/users" },
    { label: "Projects", value: totalProjects, sub: `+${newProjectsToday} today`, href: "/admin/projects" },
    { label: "Applications", value: totalApplications, sub: `+${applicationsToday} today`, href: null },
    { label: "Mod queue", value: moderationPending, sub: "pending review", href: "/admin/moderation", alert: moderationPending > 0 },
    { label: "Reports", value: reportsPending, sub: "total submitted", href: "/admin/reports", alert: reportsPending > 0 },
  ];

  return (
    <div>
      <h1 className="font-display font-bold text-2xl text-ink mb-6">Overview</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-8 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => {
          const card = (
            <div className={`rounded-sm bg-paper p-4 shadow-sm border ${s.alert ? "border-pin-red/40" : "border-paper-edge"}`}>
              <p className="font-mono text-[0.65rem] uppercase tracking-widest text-ink-soft mb-1">{s.label}</p>
              <p className={`font-display font-bold text-3xl ${s.alert ? "text-pin-red" : "text-ink"}`}>{s.value}</p>
              <p className="font-mono text-xs text-ink-soft mt-1">{s.sub}</p>
            </div>
          );
          return s.href ? (
            <Link key={s.label} href={s.href} className="hover:opacity-80 transition-opacity">
              {card}
            </Link>
          ) : (
            <div key={s.label}>{card}</div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Recent signups */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-mono text-xs uppercase tracking-widest text-ink-soft">Recent signups</h2>
            <Link href="/admin/users" className="font-mono text-xs text-ink-soft hover:text-ink">all →</Link>
          </div>
          <div className="rounded-sm bg-paper border border-paper-edge divide-y divide-paper-edge">
            {recentSignups.map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="h-7 w-7 flex-shrink-0 rounded-full bg-pin-gold flex items-center justify-center font-mono text-xs font-semibold text-ink">
                  {(u.displayName ?? u.githubLogin ?? "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <Link href={`/u/${u.githubLogin}`} className="font-medium text-sm text-ink hover:underline truncate block">
                    {u.displayName ?? u.githubLogin}
                  </Link>
                  <p className="font-mono text-[0.65rem] text-ink-soft">@{u.githubLogin}</p>
                </div>
                <p className="font-mono text-[0.65rem] text-ink-soft flex-shrink-0">
                  {new Date(u.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Recent projects */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-mono text-xs uppercase tracking-widest text-ink-soft">Recent projects</h2>
            <Link href="/admin/projects" className="font-mono text-xs text-ink-soft hover:text-ink">all →</Link>
          </div>
          <div className="rounded-sm bg-paper border border-paper-edge divide-y divide-paper-edge">
            {recentProjects.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <Link href={`/p/${p.slug}`} className="font-medium text-sm text-ink hover:underline truncate block">
                    {p.title}
                  </Link>
                  <p className="font-mono text-[0.65rem] text-ink-soft">@{p.owner.githubLogin}</p>
                </div>
                <p className="font-mono text-[0.65rem] text-ink-soft flex-shrink-0">
                  {new Date(p.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
