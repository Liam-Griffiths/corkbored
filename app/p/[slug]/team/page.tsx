import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();

  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true, moderationStatus: true },
  });
  if (!project || project.moderationStatus === "removed") notFound();

  const userId = session?.user?.id;
  const memberships = await prisma.membership.findMany({
    where: { projectId: project.id, leftAt: null },
    orderBy: { joinedAt: "asc" },
    include: { user: { select: { id: true, displayName: true, githubLogin: true, avatarUrl: true, skills: true } } },
  });

  const myMembership = memberships.find((m) => m.userId === userId);
  const isOwner = myMembership?.role === "owner";

  async function removeMember(formData: FormData) {
    "use server";
    const s = await auth();
    if (!s?.user?.id) return;
    const membershipId = formData.get("membershipId") as string;
    await prisma.membership.update({
      where: { id: membershipId },
      data: { leftAt: new Date(), removedById: s.user.id },
    });
    redirect(`/p/${slug}/team`);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display font-bold text-xl text-ink mb-1">Team</h1>
      <p className="font-mono text-sm text-ink-soft mb-6">{memberships.length} member{memberships.length !== 1 ? "s" : ""}</p>

      <div className="space-y-3">
        {memberships.map((m) => {
          const name = m.user?.displayName ?? m.user?.githubLogin ?? "?";
          const login = m.user?.githubLogin;
          const skills = m.user?.skills?.slice(0, 4) ?? [];
          return (
            <div key={m.id} className="flex items-center gap-4 rounded-lg border border-paper-edge bg-paper p-4">
              {login ? (
                <Link href={`/u/${login}`} className="flex-shrink-0">
                  {m.user?.avatarUrl ? (
                    <Image src={m.user.avatarUrl} alt={name} width={40} height={40} className="rounded-full" />
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-pin-gold text-sm font-semibold text-ink">
                      {name[0].toUpperCase()}
                    </span>
                  )}
                </Link>
              ) : (
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-pin-gold text-sm font-semibold text-ink">
                  {name[0].toUpperCase()}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  {login ? (
                    <Link href={`/u/${login}`} className="font-semibold text-sm text-ink hover:underline">{name}</Link>
                  ) : (
                    <span className="font-semibold text-sm text-ink">{name}</span>
                  )}
                  {(m.role as string) === "owner" && (
                    <span className="rounded-sm bg-ink px-1.5 py-0.5 font-mono text-[0.58rem] text-paper">owner</span>
                  )}
                  {(m.role as string) === "maintainer" && (
                    <span className="rounded-sm bg-pin-teal px-1.5 py-0.5 font-mono text-[0.58rem] text-white">maintainer</span>
                  )}
                </div>
                {login && <p className="font-mono text-xs text-ink-soft">@{login}</p>}
                {skills.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {skills.map((s) => (
                      <span key={s.skill} className="rounded-sm bg-paper-edge px-1.5 py-0.5 font-mono text-[0.6rem] text-ink-soft">
                        {s.skill}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {isOwner && m.userId !== userId && (m.role as string) !== "owner" && (
                <form action={removeMember} className="flex-shrink-0">
                  <input type="hidden" name="membershipId" value={m.id} />
                  <button type="submit" className="rounded-md border border-paper-edge px-3 py-1.5 font-mono text-xs text-ink-soft hover:border-ink-soft hover:text-pin-red">
                    Remove
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-6 font-mono text-xs text-ink-soft">
        Every join and leave is timestamped — this record backs contribution attribution.
      </p>
    </div>
  );
}
