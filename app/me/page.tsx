import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { limitsFor, tierForUser } from "@/lib/limits";
import { Header } from "@/components/Header";
import { DeleteAccountButton } from "@/components/DeleteAccountButton";
import { DataExportPanel } from "@/components/DataExportPanel";

export default async function MePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin?callbackUrl=/me");

  const userId = session.user.id;

  const [user, applications, memberships, links, latestExport] = await Promise.all([
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
    prisma.userLink.findMany({
      where: { userId },
      orderBy: { position: "asc" },
    }),
    prisma.dataExport.findFirst({
      where: { userId },
      orderBy: { requestedAt: "desc" },
      select: { id: true, status: true, requestedAt: true, completedAt: true, expiresAt: true },
    }),
  ]);

  if (!user) redirect("/");

  const maxLinks = limitsFor(user.tier).profileLinks;

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

  async function addLink(formData: FormData) {
    "use server";
    const s = await auth();
    if (!s?.user?.id) return;

    const label = (formData.get("label") as string)?.trim();
    const url = (formData.get("url") as string)?.trim();
    if (!label || !url) return;

    let parsedUrl = url;
    if (!/^https?:\/\//i.test(url)) parsedUrl = `https://${url}`;

    const limit = limitsFor(await tierForUser(s.user.id)).profileLinks;
    const count = await prisma.userLink.count({ where: { userId: s.user.id } });
    if (count >= limit) return;

    await prisma.userLink.create({
      data: { userId: s.user.id, label, url: parsedUrl, position: count },
    });

    const { redirect: redir } = await import("next/navigation");
    redir("/me");
  }

  async function removeLink(formData: FormData) {
    "use server";
    const s = await auth();
    if (!s?.user?.id) return;

    const id = formData.get("id") as string;
    if (!id) return;

    await prisma.userLink.deleteMany({ where: { id, userId: s.user.id } });

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
          <div className="flex-1">
            <h1 className="font-display font-bold text-2xl text-ink">
              {user.displayName ?? user.githubLogin}
            </h1>
            <p className="font-mono text-sm text-ink-soft">
              @{user.githubLogin}
            </p>
          </div>
          {user.githubLogin && (
            <Link
              href={`/u/${user.githubLogin}`}
              className="font-mono text-xs text-ink-soft hover:text-ink border border-paper-edge rounded-md px-3 py-1.5"
            >
              View profile →
            </Link>
          )}
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

        {/* My links */}
        <section className="mb-8 rounded-sm bg-paper p-6 shadow-[0_14px_30px_rgba(0,0,0,.18)]">
          <h2 className="font-display font-semibold text-lg text-ink mb-1">My links</h2>
          <p className="font-mono text-xs text-ink-soft mb-4">
            Show on your public profile. {links.length} / {maxLinks} used.
          </p>

          {links.length > 0 && (
            <div className="mb-4 space-y-2">
              {links.map((link) => (
                <div key={link.id} className="flex items-center gap-3 rounded-md border border-paper-edge px-3 py-2">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 font-mono text-sm text-ink hover:underline truncate"
                  >
                    <span className="font-semibold">{link.label}</span>
                    <span className="ml-2 text-ink-soft text-xs">{link.url}</span>
                  </a>
                  <form action={removeLink}>
                    <input type="hidden" name="id" value={link.id} />
                    <button type="submit" className="font-mono text-xs text-ink-soft hover:text-pin-red">
                      remove
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}

          {links.length < maxLinks && (
            <form action={addLink} className="flex flex-wrap gap-2">
              <input
                name="label"
                required
                maxLength={40}
                placeholder="Label (e.g. Twitter)"
                className="rounded-md border border-paper-edge bg-paper-bright px-3 py-2 font-sans text-sm text-ink placeholder:text-ink-soft focus:outline-2 focus:outline-pin-gold w-36"
              />
              <input
                name="url"
                required
                maxLength={300}
                placeholder="https://..."
                className="flex-1 min-w-40 rounded-md border border-paper-edge bg-paper-bright px-3 py-2 font-sans text-sm text-ink placeholder:text-ink-soft focus:outline-2 focus:outline-pin-gold"
              />
              <button
                type="submit"
                className="rounded-md bg-pin-red px-4 py-2 font-mono text-sm font-medium text-white shadow-[0_2px_0_#7c2d14] hover:-translate-y-px"
              >
                Add
              </button>
            </form>
          )}
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

        {/* Privacy & account */}
        <section>
          <h2 className="font-display font-semibold text-lg text-ink mb-1">Privacy &amp; data</h2>
          <p className="font-mono text-xs text-ink-soft mb-4">
            Export your data or permanently delete your account.{" "}
            <Link href="/privacy" className="text-pin-teal underline underline-offset-2">Privacy policy</Link>
          </p>

          <DataExportPanel
            initialExport={
              latestExport
                ? {
                    id: latestExport.id,
                    status: latestExport.status as "pending" | "ready" | "failed",
                    requestedAt: latestExport.requestedAt.toISOString(),
                    completedAt: latestExport.completedAt?.toISOString() ?? null,
                    expiresAt: latestExport.expiresAt?.toISOString() ?? null,
                  }
                : null
            }
          />

          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-pin-red/30 bg-paper p-4">
            <div className="flex-1 min-w-0">
              <p className="font-mono text-xs text-ink">Delete account</p>
              <p className="font-mono text-[0.65rem] text-ink-soft">Permanently erase your account and data. This can&apos;t be undone.</p>
            </div>
            <DeleteAccountButton />
          </div>
        </section>
      </main>
    </>
  );
}
