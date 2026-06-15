import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export default async function RolesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();

  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true, moderationStatus: true, ownerId: true },
  });
  if (!project || project.moderationStatus === "removed") notFound();

  const userId = session?.user?.id;
  const membership = userId
    ? await prisma.membership.findUnique({
        where: { projectId_userId: { projectId: project.id, userId } },
        select: { role: true, leftAt: true },
      })
    : null;
  const isOwner = membership?.role === "owner" && !membership.leftAt;

  const [roles, myAppRoleIds] = await Promise.all([
    prisma.role.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "asc" },
    }),
    userId
      ? prisma.application.findMany({
          where: { applicantId: userId, role: { projectId: project.id } },
          select: { roleId: true },
        }).then((apps) => new Set(apps.map((a) => a.roleId)))
      : Promise.resolve(new Set<string>()),
  ]);

  const openRoles = roles.filter((r) => r.status === "open");

  async function addRole(formData: FormData) {
    "use server";
    const s = await auth();
    if (!s?.user?.id) return;
    const projectId = formData.get("projectId") as string;
    const title = (formData.get("title") as string)?.trim();
    const detail = (formData.get("detail") as string)?.trim() || undefined;
    if (!title) return;
    const count = await prisma.role.count({ where: { projectId, status: "open" } });
    if (count >= 5) return;
    await prisma.role.create({ data: { projectId, title, detail } });
    redirect(`/p/${slug}/roles`);
  }

  async function closeRole(formData: FormData) {
    "use server";
    const s = await auth();
    if (!s?.user?.id) return;
    const id = formData.get("id") as string;
    await prisma.role.update({ where: { id }, data: { status: "closed" } });
    redirect(`/p/${slug}/roles`);
  }

  const STATUS_COLORS: Record<string, string> = {
    open: "bg-[#d9efe6] text-pin-teal",
    filled: "bg-[#e8f0fe] text-blue-600",
    closed: "bg-paper-edge text-ink-soft",
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display font-bold text-xl text-ink mb-6">Roles</h1>

      <div className="space-y-3 mb-8">
        {roles.length === 0 ? (
          <p className="rounded-lg border border-dashed border-paper-edge p-8 text-center font-mono text-sm text-ink-soft">
            No roles yet.
          </p>
        ) : (
          roles.map((role) => (
            <div key={role.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-paper-edge bg-paper p-4">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-ink">{role.title}</p>
                {role.detail && <p className="text-xs text-ink-soft mt-0.5">{role.detail}</p>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`rounded-full px-2.5 py-0.5 font-mono text-xs ${STATUS_COLORS[role.status] ?? ""}`}>
                  {role.status}
                </span>
                {role.status === "open" && !isOwner && userId && !myAppRoleIds.has(role.id) && (
                  <Link
                    href={`/p/${slug}/apply/${role.id}`}
                    className="rounded-md bg-pin-red px-3 py-1.5 font-mono text-xs text-white shadow-[0_2px_0_#7c2d14] hover:-translate-y-px"
                  >
                    Apply
                  </Link>
                )}
                {role.status === "open" && userId && myAppRoleIds.has(role.id) && (
                  <span className="rounded-full bg-[#d9efe6] px-3 py-1 font-mono text-xs text-pin-teal">applied ✓</span>
                )}
                {isOwner && role.status === "open" && (
                  <form action={closeRole}>
                    <input type="hidden" name="id" value={role.id} />
                    <button type="submit" className="rounded-md border border-paper-edge px-2.5 py-1 font-mono text-xs text-ink-soft hover:border-ink-soft">
                      Close
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {isOwner && openRoles.length < 5 && (
        <form action={addRole} className="rounded-lg border border-paper-edge p-5 space-y-3">
          <input type="hidden" name="projectId" value={project.id} />
          <p className="font-mono text-xs uppercase tracking-widest text-ink-soft">Add a role</p>
          <input name="title" required maxLength={80} placeholder="Role title"
            className="w-full rounded-md border border-paper-edge bg-paper-bright px-3 py-2 font-sans text-sm text-ink placeholder:text-ink-soft focus:outline-2 focus:outline-pin-gold"
          />
          <input name="detail" maxLength={300} placeholder="Details — commitment, skills (optional)"
            className="w-full rounded-md border border-paper-edge bg-paper-bright px-3 py-2 font-sans text-sm text-ink placeholder:text-ink-soft focus:outline-2 focus:outline-pin-gold"
          />
          <button type="submit" className="rounded-md bg-pin-red px-4 py-2 font-mono text-sm text-white shadow-[0_2px_0_#7c2d14] hover:-translate-y-px">
            + Add role
          </button>
        </form>
      )}
      {isOwner && openRoles.length >= 5 && (
        <p className="font-mono text-xs text-ink-soft">Maximum 5 open roles reached.</p>
      )}
    </div>
  );
}
