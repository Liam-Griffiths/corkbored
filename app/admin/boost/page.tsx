import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Header } from "@/components/Header";

const BOOST_ENABLED = process.env.BOOST_ENABLED === "true";

export default async function AdminBoostPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin?callbackUrl=/admin/boost");

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.isAdmin) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-2xl px-5 py-16 text-center">
          <p className="font-mono text-sm text-ink-soft">403 — Admin only.</p>
        </main>
      </>
    );
  }

  if (!BOOST_ENABLED) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-2xl px-5 py-16 text-center">
          <p className="font-mono text-sm text-ink-soft">
            Boost feature is disabled. Set <code className="bg-paper-edge px-1 rounded">BOOST_ENABLED=true</code> to enable.
          </p>
        </main>
      </>
    );
  }

  const now = new Date();
  const boosted = await prisma.project.findMany({
    where: { boostedUntil: { gt: now } },
    orderBy: { boostedUntil: "asc" },
    select: { id: true, slug: true, title: true, boostedUntil: true },
  });

  async function setBoost(formData: FormData) {
    "use server";
    const s = await auth();
    if (!s?.user?.id) return;
    const adminUser = await prisma.user.findUnique({ where: { id: s.user.id } });
    if (!adminUser?.isAdmin) return;

    const slug = (formData.get("slug") as string).trim();
    const days = parseInt(formData.get("days") as string) || 7;

    const project = await prisma.project.findUnique({ where: { slug }, select: { id: true } });
    if (!project) redirect("/admin/boost?error=not_found");

    const boostedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await prisma.project.update({ where: { id: project.id }, data: { boostedUntil } });
    redirect("/admin/boost");
  }

  async function clearBoost(formData: FormData) {
    "use server";
    const s = await auth();
    if (!s?.user?.id) return;
    const adminUser = await prisma.user.findUnique({ where: { id: s.user.id } });
    if (!adminUser?.isAdmin) return;

    const id = formData.get("id") as string;
    await prisma.project.update({ where: { id }, data: { boostedUntil: null } });
    redirect("/admin/boost");
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-2xl px-5 py-10">
        <div className="mb-8 flex items-center gap-4">
          <h1 className="font-display font-bold text-2xl text-ink">⚡ Boost manager</h1>
          <Link href="/admin/moderation" className="font-mono text-xs text-ink-soft underline">
            ← moderation queue
          </Link>
        </div>

        {/* Set boost form */}
        <section className="mb-8 rounded-sm bg-paper p-6 shadow-[0_8px_18px_rgba(0,0,0,.18)]">
          <h2 className="mb-4 font-display font-semibold text-lg text-ink">Boost a project</h2>
          <form action={setBoost} className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[160px]">
              <label className="mb-1 block font-mono text-xs uppercase tracking-widest text-ink-soft">
                Project slug
              </label>
              <input
                name="slug"
                required
                placeholder="e.g. ledgerline"
                className="w-full rounded-md border border-paper-edge bg-paper-bright px-3 py-2 font-mono text-sm text-ink placeholder:text-ink-soft focus:outline-2 focus:outline-pin-gold"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-xs uppercase tracking-widest text-ink-soft">
                Duration
              </label>
              <select
                name="days"
                className="rounded-md border border-paper-edge bg-paper-bright px-3 py-2 font-mono text-sm text-ink focus:outline-2 focus:outline-pin-gold"
              >
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
              </select>
            </div>
            <button
              type="submit"
              className="rounded-md bg-pin-gold px-5 py-2 font-mono text-sm font-semibold text-ink shadow-[0_2px_0_#a37200] hover:-translate-y-px"
            >
              Boost ⚡
            </button>
          </form>
        </section>

        {/* Active boosts */}
        <section>
          <h2 className="mb-4 font-display font-semibold text-lg text-ink">Active boosts</h2>
          {boosted.length === 0 ? (
            <p className="rounded-lg border border-dashed border-paper-edge p-6 text-center font-mono text-sm text-ink-soft">
              No active boosts.
            </p>
          ) : (
            <div className="space-y-2">
              {boosted.map((p) => (
                <div key={p.id} className="flex items-center gap-4 rounded-lg border border-paper-edge bg-paper p-4">
                  <div className="flex-1">
                    <Link href={`/p/${p.slug}`} className="font-medium text-sm text-ink hover:underline">
                      {p.title}
                    </Link>
                    <p className="font-mono text-xs text-ink-soft">
                      expires {p.boostedUntil!.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <form action={clearBoost}>
                    <input type="hidden" name="id" value={p.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-ink/20 px-3 py-1.5 font-mono text-xs text-ink-soft hover:border-pin-red/50 hover:text-pin-red"
                    >
                      remove
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </section>

        <p className="mt-8 font-mono text-xs text-ink-soft">
          Payment integration: wire <code className="bg-paper-edge px-1 rounded">STRIPE_BOOST_PRICE_ID</code> to{" "}
          <code className="bg-paper-edge px-1 rounded">/api/webhooks/stripe</code> → sets{" "}
          <code className="bg-paper-edge px-1 rounded">boostedUntil</code> on checkout completion.
        </p>
      </main>
    </>
  );
}
