import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { acceptInvite } from "@/lib/invite";
import { Header } from "@/components/Header";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invite = await prisma.projectInvite.findUnique({
    where: { token },
    include: {
      project: { select: { slug: true, title: true, pitch: true, moderationStatus: true } },
      invitedBy: { select: { displayName: true, githubLogin: true } },
    },
  });

  if (!invite || invite.project.moderationStatus === "removed") notFound();

  const session = await auth();
  const userId = session?.user?.id;
  const inviterName =
    invite.invitedBy.displayName ?? invite.invitedBy.githubLogin ?? "A teammate";

  const dead =
    invite.status === "revoked" ||
    invite.status === "failed" ||
    (invite.status !== "accepted" && invite.expiresAt < new Date());

  // Already a signed-in member who already accepted → straight to the project.
  if (userId && invite.status === "accepted") {
    const membership = await prisma.membership.findUnique({
      where: { projectId_userId: { projectId: invite.projectId, userId } },
      select: { leftAt: true },
    });
    if (membership && !membership.leftAt) redirect(`/p/${invite.project.slug}`);
  }

  async function signInAction() {
    "use server";
    // Route through the consent gate, returning here afterwards.
    redirect(`/signin?callbackUrl=/invite/${token}`);
  }

  async function acceptAction() {
    "use server";
    const s = await auth();
    if (!s?.user?.id) redirect(`/invite/${token}`);
    const result = await acceptInvite(token, s.user.id);
    if (!result) redirect(`/invite/${token}`);
    redirect(`/p/${result.slug}`);
  }

  return (
    <>
      <Header />
      <div className="mx-auto flex max-w-md flex-col items-center px-5 py-16 text-center">
        <span className="mb-4 inline-block h-3 w-3 rounded-full bg-pin-red shadow-[inset_-2px_-2px_3px_rgba(0,0,0,.35)]" />

        {dead ? (
          <>
            <h1 className="font-display text-2xl font-extrabold text-ink">
              This invite has expired
            </h1>
            <p className="mt-3 font-mono text-sm text-ink-soft">
              The link to join {invite.project.title} is no longer valid. Ask{" "}
              {inviterName} to send you a fresh one.
            </p>
            <Link
              href="/board"
              className="mt-6 font-mono text-sm text-ink-soft hover:text-ink"
            >
              ← browse the board
            </Link>
          </>
        ) : (
          <>
            <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">
              {inviterName} invited you to join
            </p>
            <h1 className="mt-2 font-display text-2xl font-extrabold text-ink">
              {invite.project.title}
            </h1>
            {invite.project.pitch && (
              <p className="mt-3 font-mono text-sm text-ink-soft">{invite.project.pitch}</p>
            )}
            <p className="mt-2 font-mono text-xs text-ink-soft">
              as a {invite.role}
            </p>

            {userId ? (
              <form action={acceptAction} className="mt-7">
                <button
                  type="submit"
                  className="rounded-md bg-pin-red px-6 py-2 font-mono text-sm text-white shadow-[0_2px_0_#7c2d14] transition-transform hover:-translate-y-px"
                >
                  Join {invite.project.title}
                </button>
              </form>
            ) : (
              <form action={signInAction} className="mt-7">
                <button
                  type="submit"
                  className="rounded-md bg-pin-red px-6 py-2 font-mono text-sm text-white shadow-[0_2px_0_#7c2d14] transition-transform hover:-translate-y-px"
                >
                  Sign in with GitHub to join
                </button>
                <p className="mt-3 font-mono text-xs text-ink-soft">
                  No account yet? Signing in creates one automatically.
                </p>
              </form>
            )}
          </>
        )}
      </div>
    </>
  );
}
