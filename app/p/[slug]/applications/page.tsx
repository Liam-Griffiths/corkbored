import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { LinkedText } from "@/components/SafeLink";

export default async function ApplicationsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();

  if (!session?.user?.id) redirect(`/api/auth/signin?callbackUrl=/p/${slug}/applications`);

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
  const isOwner = (membership.role as string) === "owner";
  if (!["owner", "maintainer"].includes(membership.role as string)) redirect(`/p/${slug}`);

  const applications = await prisma.application.findMany({
    where: { role: { projectId: project.id } },
    orderBy: { createdAt: "desc" },
    include: {
      applicant: { select: { id: true, displayName: true, githubLogin: true } },
      role: { select: { id: true, title: true, projectId: true } },
    },
  });

  const pendingCount = applications.filter((a) => a.status === "pending").length;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display font-bold text-xl text-ink mb-1">Applications</h1>
      {pendingCount > 0 && (
        <p className="font-mono text-sm text-ink-soft mb-6">
          {pendingCount} pending
        </p>
      )}

      <div className="space-y-4 mt-6">
        {applications.length === 0 ? (
          <p className="rounded-lg border border-dashed border-paper-edge p-8 text-center font-mono text-sm text-ink-soft">
            No applications yet. Share your project link.
          </p>
        ) : (
          applications.map((app) => {
            const stats = app.githubStatsCache as Record<string, unknown> | null;
            const inviteFailed = app.githubInviteStatus === "failed";
            return (
              <div key={app.id} className="rounded-lg border border-paper-edge bg-paper p-4">
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
                    <DecideForm
                      applicationId={app.id}
                      projectId={app.role.projectId}
                      applicantId={app.applicant.id}
                      slug={slug}
                      decision="accepted"
                    />
                    <DecideForm
                      applicationId={app.id}
                      projectId={app.role.projectId}
                      applicantId={app.applicant.id}
                      slug={slug}
                      decision="declined"
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
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
    const { auth: getAuth } = await import("@/lib/auth");
    const { prisma: db } = await import("@/lib/db");
    const session = await getAuth();
    if (!session?.user?.id) return;

    await db.$transaction(async (tx) => {
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

    const { redirect: redir } = await import("next/navigation");
    redir(`/p/${slug}/applications`);
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
