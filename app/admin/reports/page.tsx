import { prisma } from "@/lib/db";
import Link from "next/link";

export default async function AdminReportsPage() {
  const reports = await prisma.report.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      reporter: { select: { githubLogin: true } },
      moderationItems: { select: { id: true, decidedAt: true, verdict: true } },
    },
  });

  const SUBJECT_HREF: Record<string, (id: string) => string | null> = {
    project: (id) => `/p/${id}`,
    application: () => null,
    announcement: () => null,
  };

  return (
    <div>
      <h1 className="font-display font-bold text-2xl text-ink mb-1">Reports</h1>
      <p className="font-mono text-xs text-ink-soft mb-6">{reports.length} total</p>

      {reports.length === 0 ? (
        <div className="rounded-lg border border-dashed border-paper-edge p-10 text-center">
          <p className="font-mono text-sm text-ink-soft">No reports yet.</p>
        </div>
      ) : (
        <div className="rounded-sm bg-paper border border-paper-edge divide-y divide-paper-edge">
          {reports.map((r) => {
            const decided = r.moderationItems.some((m) => m.decidedAt);
            return (
              <div key={r.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="rounded-sm bg-ink px-1.5 py-0.5 font-mono text-[0.6rem] uppercase text-paper">
                    {r.subjectType}
                  </span>
                  {decided ? (
                    <span className="rounded-full bg-[#d9efe6] px-2 py-0.5 font-mono text-[0.6rem] text-pin-teal">resolved</span>
                  ) : (
                    <span className="rounded-full bg-[#fff8e1] px-2 py-0.5 font-mono text-[0.6rem] text-pin-gold">open</span>
                  )}
                  <span className="font-mono text-xs text-ink-soft">
                    by @{r.reporter.githubLogin} · {new Date(r.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
                <p className="text-sm text-ink mb-1">{r.reason}</p>
                <div className="flex items-center gap-3">
                  <p className="font-mono text-[0.65rem] text-ink-soft truncate">ID: {r.subjectId}</p>
                  {!decided && (
                    <Link
                      href="/admin/moderation"
                      className="font-mono text-[0.65rem] text-ink-soft hover:text-ink underline"
                    >
                      review in mod queue →
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
