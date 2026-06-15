import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Header } from "@/components/Header";

export default async function MePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin?callbackUrl=/me");

  const userId = session.user.id;

  const [user, applications, memberships] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: { skills: true },
    }),
    prisma.application.findMany({
      where: { applicantId: userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        role: { select: { title: true, project: { select: { slug: true, title: true } } } },
      },
    }),
    prisma.membership.findMany({
      where: { userId, leftAt: null },
      orderBy: { joinedAt: "desc" },
      include: {
        project: { select: { id: true, slug: true, title: true, stage: true } },
      },
    }),
  ]);

  if (!user) redirect("/");

  async function saveProfile(formData: FormData) {
    "use server";
    const s = await auth();
    if (!s?.user?.id) return;

    const availability = (formData.get("availability") as string)?.trim() || null;
    const hoursPerWeek = parseInt(formData.get("hoursPerWeek") as string) || null;
    const lookingFor = (formData.get("lookingFor") as string)?.trim() || null;
    const skillsRaw = (formData.get("skills") as string)
      ?.split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 20) ?? [];

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: s.user.id },
        data: { availability, hoursPerWeek, lookingFor },
      });

      await tx.userSkill.deleteMany({ where: { userId: s.user.id } });
      if (skillsRaw.length > 0) {
        await tx.userSkill.createMany({
          data: skillsRaw.map((skill) => ({ userId: s.user.id, skill })),
        });
      }
    });

    const { redirect: redir } = await import("next/navigation");
    redir("/me");
  }

  const currentSkills = user.skills.map((s) => s.skill).join(", ");

  const APP_STATUS_STYLES: Record<string, string> = {
    pending: "bg-board text-ink-soft",
    accepted: "bg-[#d9efe6] text-pin-teal",
    declined: "bg-[#f4ded9] text-pin-red",
  };

  const STAGE_STYLES: Record<string, string> = {
    launched: "bg-pin-red text-white",
    prototype: "bg-pin-gold text-ink",
    building: "bg-pin-teal text-white",
  };

  return (
    <>
      <Header />
      <main className="mx-auto max-w-2xl px-5 py-10">
        <div className="flex items-center gap-4 mb-8">
          {user.avatarUrl && (
            <Image
              src={user.avatarUrl}
              alt={user.displayName ?? ""}
              width={64}
              height={64}
              className="h-16 w-16 rounded-full border-2 border-paper-edge"
            />
          )}
          <div>
            <h1 className="font-display font-bold text-2xl text-ink">
              {user.displayName ?? user.githubLogin}
            </h1>
            <p className="font-mono text-sm text-ink-soft">
              @{user.githubLogin}
            </p>
          </div>
        </div>

        {/* Profile edit form */}
        <section className="mb-8 rounded-sm bg-paper p-6 shadow-[0_14px_30px_rgba(0,0,0,.18)]">
          <h2 className="font-display font-semibold text-lg text-ink mb-4">Edit profile</h2>
          <form action={saveProfile} className="space-y-4">
            <div>
              <label htmlFor="availability" className="mb-1 block font-mono text-xs uppercase tracking-widest text-ink-soft">
                Availability
              </label>
              <input
                id="availability"
                name="availability"
                defaultValue={user.availability ?? ""}
                placeholder="e.g. evenings and weekends"
                maxLength={200}
                className="w-full rounded-md border border-paper-edge bg-paper-bright px-3 py-2 font-sans text-sm text-ink placeholder:text-ink-soft focus:outline-2 focus:outline-pin-gold"
              />
            </div>
            <div>
              <label htmlFor="hoursPerWeek" className="mb-1 block font-mono text-xs uppercase tracking-widest text-ink-soft">
                Hours / week
              </label>
              <input
                id="hoursPerWeek"
                name="hoursPerWeek"
                type="number"
                min={1}
                max={168}
                defaultValue={user.hoursPerWeek ?? ""}
                placeholder="e.g. 10"
                className="w-32 rounded-md border border-paper-edge bg-paper-bright px-3 py-2 font-sans text-sm text-ink placeholder:text-ink-soft focus:outline-2 focus:outline-pin-gold"
              />
            </div>
            <div>
              <label htmlFor="skills" className="mb-1 block font-mono text-xs uppercase tracking-widest text-ink-soft">
                Skills (comma-separated)
              </label>
              <input
                id="skills"
                name="skills"
                defaultValue={currentSkills}
                placeholder="e.g. typescript, rust, design"
                className="w-full rounded-md border border-paper-edge bg-paper-bright px-3 py-2 font-sans text-sm text-ink placeholder:text-ink-soft focus:outline-2 focus:outline-pin-gold"
              />
            </div>
            <div>
              <label htmlFor="lookingFor" className="mb-1 block font-mono text-xs uppercase tracking-widest text-ink-soft">
                Looking for
              </label>
              <textarea
                id="lookingFor"
                name="lookingFor"
                defaultValue={user.lookingFor ?? ""}
                placeholder="What kind of projects or roles are you seeking?"
                rows={2}
                maxLength={500}
                className="w-full rounded-md border border-paper-edge bg-paper-bright px-3 py-2 font-sans text-sm text-ink placeholder:text-ink-soft focus:outline-2 focus:outline-pin-gold resize-y"
              />
            </div>
            <button
              type="submit"
              className="rounded-md bg-pin-red px-5 py-2.5 font-mono text-sm font-medium text-white shadow-[0_2px_0_#7c2d14] hover:-translate-y-px"
            >
              Save
            </button>
          </form>
        </section>

        {/* My memberships */}
        <section className="mb-8">
          <h2 className="font-display font-semibold text-lg text-ink mb-4">My projects</h2>
          {memberships.length === 0 ? (
            <p className="rounded-lg border border-dashed border-paper-edge p-6 text-center font-mono text-sm text-ink-soft">
              Not a member of any projects yet.{" "}
              <Link href="/board" className="underline hover:text-ink">Browse the board.</Link>
            </p>
          ) : (
            <div className="space-y-2">
              {memberships.map((m) => (
                <Link
                  key={m.id}
                  href={`/p/${m.project.slug}`}
                  className="flex items-center gap-3 rounded-lg border border-paper-edge bg-paper p-4 hover:border-ink-soft"
                >
                  <span className="flex-1 font-medium text-sm text-ink">{m.project.title}</span>
                  <span className={`rounded-sm px-1.5 py-0.5 font-mono text-[0.62rem] uppercase ${STAGE_STYLES[m.project.stage] ?? "bg-board text-ink-soft"}`}>
                    {m.project.stage}
                  </span>
                  <span className="font-mono text-xs text-ink-soft">{m.role}</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* My applications */}
        <section>
          <h2 className="font-display font-semibold text-lg text-ink mb-4">My applications</h2>
          {applications.length === 0 ? (
            <p className="rounded-lg border border-dashed border-paper-edge p-6 text-center font-mono text-sm text-ink-soft">
              No applications yet.
            </p>
          ) : (
            <div className="space-y-2">
              {applications.map((app) => (
                <div key={app.id} className="flex items-center gap-3 rounded-lg border border-paper-edge bg-paper p-4">
                  <div className="flex-1">
                    <Link href={`/p/${app.role.project.slug}`} className="font-medium text-sm text-ink hover:underline">
                      {app.role.project.title}
                    </Link>
                    <p className="font-mono text-xs text-ink-soft">{app.role.title}</p>
                  </div>
                  <span className={`rounded-full px-3 py-0.5 font-mono text-xs ${APP_STATUS_STYLES[app.status] ?? "bg-board text-ink-soft"}`}>
                    {app.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
