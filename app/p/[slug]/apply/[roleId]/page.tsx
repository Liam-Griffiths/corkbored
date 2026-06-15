import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Header } from "@/components/Header";

interface Props {
  params: Promise<{ slug: string; roleId: string }>;
}

export default async function ApplyPage({ params }: Props) {
  const { slug, roleId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/api/auth/signin?callbackUrl=/p/${slug}/apply/${roleId}`);
  }
  const userId = session.user.id;

  const [role, existingApp] = await Promise.all([
    prisma.role.findUnique({
      where: { id: roleId },
      include: { project: { select: { id: true, slug: true, title: true, ownerId: true, repoFullName: true } } },
    }),
    prisma.application.findUnique({
      where: { roleId_applicantId: { roleId, applicantId: userId } },
    }),
  ]);

  if (!role || role.project.slug !== slug || role.status !== "open") notFound();
  if (role.project.ownerId === userId) redirect(`/p/${slug}`);
  if (existingApp) redirect(`/p/${slug}`);

  const projectId = role.project.id;

  async function applyAction(formData: FormData) {
    "use server";
    const session2 = await auth();
    if (!session2?.user?.id) redirect("/api/auth/signin");
    const uid = session2.user.id;

    const pitch = (formData.get("pitch") as string)?.trim();
    if (!pitch || pitch.length < 20 || pitch.length > 500) return;

    // Rate limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await prisma.application.count({
      where: { applicantId: uid, createdAt: { gte: today } },
    });
    if (todayCount >= 10) return;

    // Dedup guard
    const already = await prisma.application.findUnique({
      where: { roleId_applicantId: { roleId, applicantId: uid } },
    });
    if (already) redirect(`/p/${slug}`);

    const githubStats = await prisma.githubStats.findUnique({ where: { userId: uid } });

    const app = await prisma.application.create({
      data: {
        roleId,
        applicantId: uid,
        pitch,
        githubStatsCache: githubStats
          ? {
              accountAgeYears: githubStats.accountAgeYears,
              publicRepos: githubStats.publicRepos,
              commitsLast90d: githubStats.commitsLast90d,
              topLanguages: githubStats.topLanguages,
            }
          : undefined,
      },
    });

    // Notification handled by /api/roles/[id]/applications route — not duplicated here.

    redirect(`/p/${slug}?applied=1`);
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-xl px-5 py-10">
        <Link href={`/p/${slug}`} className="mb-6 inline-block font-mono text-sm text-ink-soft hover:text-ink">
          ← back to {role.project.title}
        </Link>

        <div className="relative mt-8 rounded-sm bg-paper p-8 shadow-[0_14px_30px_rgba(0,0,0,.18)]">
          <span
            className="absolute -top-2.5 left-1/2 -translate-x-1/2 h-5 w-5 rounded-full bg-[radial-gradient(circle_at_35%_30%,#ff8a72,#c94e2a_60%,#7c2d14)] shadow-[0_3px_5px_rgba(0,0,0,.4)]"
            aria-hidden="true"
          />
          <h1 className="font-display font-semibold text-xl text-ink mb-1">
            Apply to collaborate
          </h1>
          <p className="font-mono text-sm text-ink-soft mb-6">
            {role.title} · {role.project.title}
          </p>

          <form action={applyAction}>
            <label htmlFor="pitch" className="mb-2 block font-mono text-xs uppercase tracking-widest text-ink-soft">
              Your pitch
            </label>
            <textarea
              id="pitch"
              name="pitch"
              required
              minLength={20}
              maxLength={500}
              rows={5}
              placeholder="Why you, why this project? Keep it short — your GitHub history travels with this."
              className="w-full rounded-lg border border-paper-edge bg-paper-bright p-3 font-sans text-sm text-ink placeholder:text-ink-soft focus:outline-2 focus:outline-pin-gold resize-y"
            />
            <p className="mt-1 font-mono text-xs text-ink-soft">
              20–500 characters. Your GitHub profile and recent activity attach automatically.
            </p>

            <div className="mt-6 flex gap-3">
              <button
                type="submit"
                className="rounded-md bg-pin-red px-5 py-2.5 font-mono text-sm font-medium text-white shadow-[0_2px_0_#7c2d14] hover:-translate-y-px active:translate-y-px"
              >
                Send application
              </button>
              <Link
                href={`/p/${slug}`}
                className="rounded-md border border-paper-edge px-5 py-2.5 font-mono text-sm text-ink-soft hover:border-ink-soft"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </main>
    </>
  );
}
