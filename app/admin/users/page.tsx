import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function AdminUsersPage({ searchParams }: Props) {
  const { q } = await searchParams;

  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { githubLogin: { contains: q, mode: "insensitive" } },
            { displayName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      githubLogin: true,
      displayName: true,
      email: true,
      isAdmin: true,
      createdAt: true,
      _count: { select: { memberships: true, applications: true, ownedProjects: true } },
    },
  });

  async function toggleAdmin(formData: FormData) {
    "use server";
    const s = await auth();
    if (!s?.user?.id) return;
    const adminUser = await prisma.user.findUnique({ where: { id: s.user.id } });
    if (!adminUser?.isAdmin) return;

    const userId = formData.get("userId") as string;
    const makeAdmin = formData.get("makeAdmin") === "true";
    if (userId === s.user.id) return; // can't change own role

    await prisma.user.update({ where: { id: userId }, data: { isAdmin: makeAdmin } });
    redirect(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  }

  return (
    <div>
      <h1 className="font-display font-bold text-2xl text-ink mb-6">Users</h1>

      {/* Search */}
      <form className="mb-6 flex gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by login, name, or email…"
          className="flex-1 rounded-md border border-paper-edge bg-paper px-3 py-2 font-mono text-sm text-ink placeholder:text-ink-soft focus:outline-2 focus:outline-pin-gold"
        />
        <button
          type="submit"
          className="rounded-md bg-ink px-4 py-2 font-mono text-sm text-paper hover:opacity-80"
        >
          Search
        </button>
      </form>

      <p className="font-mono text-xs text-ink-soft mb-3">{users.length} user{users.length !== 1 ? "s" : ""}</p>

      <div className="rounded-sm bg-paper border border-paper-edge divide-y divide-paper-edge">
        {users.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Link href={`/u/${u.githubLogin}`} className="font-medium text-sm text-ink hover:underline">
                  {u.displayName ?? u.githubLogin}
                </Link>
                {u.isAdmin && (
                  <span className="rounded-sm bg-ink px-1.5 py-0.5 font-mono text-[0.6rem] uppercase text-paper">admin</span>
                )}
              </div>
              <p className="font-mono text-xs text-ink-soft">
                @{u.githubLogin} · {u.email ?? "no email"} · joined {new Date(u.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </p>
              <p className="font-mono text-[0.65rem] text-ink-soft mt-0.5">
                {u._count.ownedProjects} owned · {u._count.memberships} memberships · {u._count.applications} applications
              </p>
            </div>
            <form action={toggleAdmin} className="flex-shrink-0">
              <input type="hidden" name="userId" value={u.id} />
              <input type="hidden" name="makeAdmin" value={u.isAdmin ? "false" : "true"} />
              <button
                type="submit"
                className={`rounded-md border px-3 py-1 font-mono text-xs transition-colors ${
                  u.isAdmin
                    ? "border-pin-red/30 text-pin-red hover:border-pin-red"
                    : "border-paper-edge text-ink-soft hover:border-ink-soft hover:text-ink"
                }`}
              >
                {u.isAdmin ? "Revoke admin" : "Make admin"}
              </button>
            </form>
          </div>
        ))}

        {users.length === 0 && (
          <p className="px-4 py-8 text-center font-mono text-sm text-ink-soft">No users found.</p>
        )}
      </div>
    </div>
  );
}
