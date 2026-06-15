import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";

interface Props {
  searchParams: Promise<{ q?: string; status?: string }>;
}

export default async function AdminProjectsPage({ searchParams }: Props) {
  const { q, status } = await searchParams;

  const where = {
    ...(q ? {
      OR: [
        { title: { contains: q, mode: "insensitive" as const } },
        { slug: { contains: q, mode: "insensitive" as const } },
        { repoFullName: { contains: q, mode: "insensitive" as const } },
      ],
    } : {}),
    ...(status ? { moderationStatus: status as "published" | "held" | "removed" } : {}),
  };

  const projects = await prisma.project.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      owner: { select: { githubLogin: true } },
      _count: { select: { memberships: true, roles: true } },
    },
  });

  async function setStatus(formData: FormData) {
    "use server";
    const s = await auth();
    if (!s?.user?.id) return;
    const adminUser = await prisma.user.findUnique({ where: { id: s.user.id } });
    if (!adminUser?.isAdmin) return;

    const id = formData.get("id") as string;
    const newStatus = formData.get("status") as string;
    await prisma.project.update({ where: { id }, data: { moderationStatus: newStatus as never } });
    redirect(`/admin/projects${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  }

  const STATUS_STYLES: Record<string, string> = {
    published: "bg-[#d9efe6] text-pin-teal",
    held: "bg-[#fff8e1] text-pin-gold",
    removed: "bg-[#f4ded9] text-pin-red",
  };

  const STAGE_STYLES: Record<string, string> = {
    launched: "bg-pin-red text-white",
    prototype: "bg-pin-gold text-ink",
    building: "bg-pin-teal text-white",
  };

  return (
    <div>
      <h1 className="font-display font-bold text-2xl text-ink mb-6">Projects</h1>

      {/* Search + filter */}
      <form className="mb-6 flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by title, slug, or repo…"
          className="flex-1 min-w-48 rounded-md border border-paper-edge bg-paper px-3 py-2 font-mono text-sm text-ink placeholder:text-ink-soft focus:outline-2 focus:outline-pin-gold"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="rounded-md border border-paper-edge bg-paper px-3 py-2 font-mono text-sm text-ink focus:outline-2 focus:outline-pin-gold"
        >
          <option value="">All statuses</option>
          <option value="published">Published</option>
          <option value="held">Held</option>
          <option value="removed">Removed</option>
        </select>
        <button
          type="submit"
          className="rounded-md bg-ink px-4 py-2 font-mono text-sm text-paper hover:opacity-80"
        >
          Filter
        </button>
      </form>

      <p className="font-mono text-xs text-ink-soft mb-3">{projects.length} project{projects.length !== 1 ? "s" : ""}</p>

      <div className="rounded-sm bg-paper border border-paper-edge divide-y divide-paper-edge">
        {projects.map((p) => (
          <div key={p.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-0.5">
                <Link href={`/p/${p.slug}`} className="font-medium text-sm text-ink hover:underline">
                  {p.title}
                </Link>
                <span className={`rounded-sm px-1.5 py-0.5 font-mono text-[0.6rem] uppercase ${STAGE_STYLES[p.stage] ?? ""}`}>
                  {p.stage}
                </span>
                <span className={`rounded-full px-2 py-0.5 font-mono text-[0.6rem] ${STATUS_STYLES[p.moderationStatus] ?? ""}`}>
                  {p.moderationStatus}
                </span>
              </div>
              <p className="font-mono text-xs text-ink-soft">
                @{p.owner.githubLogin} · {p.repoFullName} · {new Date(p.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </p>
              <p className="font-mono text-[0.65rem] text-ink-soft mt-0.5">
                {p._count.memberships} members · {p._count.roles} roles
              </p>
            </div>
            <div className="flex gap-1.5 flex-shrink-0">
              {p.moderationStatus !== "published" && (
                <form action={setStatus}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="status" value="published" />
                  <button type="submit" className="rounded-md border border-paper-edge px-2.5 py-1 font-mono text-[0.65rem] text-ink-soft hover:border-pin-teal hover:text-pin-teal">
                    Publish
                  </button>
                </form>
              )}
              {p.moderationStatus !== "held" && (
                <form action={setStatus}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="status" value="held" />
                  <button type="submit" className="rounded-md border border-paper-edge px-2.5 py-1 font-mono text-[0.65rem] text-ink-soft hover:border-pin-gold hover:text-pin-gold">
                    Hold
                  </button>
                </form>
              )}
              {p.moderationStatus !== "removed" && (
                <form action={setStatus}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="status" value="removed" />
                  <button type="submit" className="rounded-md border border-paper-edge px-2.5 py-1 font-mono text-[0.65rem] text-ink-soft hover:border-pin-red hover:text-pin-red">
                    Remove
                  </button>
                </form>
              )}
            </div>
          </div>
        ))}

        {projects.length === 0 && (
          <p className="px-4 py-8 text-center font-mono text-sm text-ink-soft">No projects found.</p>
        )}
      </div>
    </div>
  );
}
