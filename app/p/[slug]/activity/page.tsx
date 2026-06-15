import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

const EVENT_LABELS: Record<string, string> = {
  commit: "pushed a commit",
  pr_merged: "merged a PR",
  release: "published a release",
  manual: "completed a task",
};

export default async function ActivityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();

  if (!session?.user?.id) redirect(`/api/auth/signin?callbackUrl=/p/${slug}/activity`);

  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true, moderationStatus: true },
  });
  if (!project || project.moderationStatus === "removed") notFound();

  const membership = await prisma.membership.findUnique({
    where: { projectId_userId: { projectId: project.id, userId: session.user.id } },
    select: { role: true, leftAt: true },
  });
  if (!membership || membership.leftAt) redirect(`/p/${slug}`);
  if (!["owner", "maintainer"].includes(membership.role as string)) redirect(`/p/${slug}`);

  const contributions = await prisma.contributionEvent.findMany({
    where: { projectId: project.id },
    orderBy: { occurredAt: "desc" },
    take: 100,
    include: { user: { select: { displayName: true, githubLogin: true } } },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display font-bold text-xl text-ink mb-6">Activity</h1>

      {contributions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-paper-edge p-8 text-center">
          <p className="font-mono text-sm text-ink-soft">No activity yet.</p>
          <p className="font-mono text-xs text-ink-soft mt-1">
            Activity populates once your GitHub App webhook is configured.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-dashed divide-paper-edge">
          {contributions.map((ev) => {
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
      )}
    </div>
  );
}
