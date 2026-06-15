import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export default async function ModerationQueuePage() {
  const items = await prisma.moderationItem.findMany({
    where: { decidedAt: null },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      report: { include: { reporter: { select: { githubLogin: true } } } },
      application: { include: { applicant: { select: { githubLogin: true } }, role: { select: { title: true } } } },
      announcement: { select: { title: true, body: true, project: { select: { slug: true, title: true } } } },
    },
  });

  return (
    <div>
      <h1 className="font-display font-bold text-2xl text-ink mb-1">Moderation queue</h1>
      <p className="font-mono text-sm text-ink-soft mb-6">{items.length} undecided item{items.length !== 1 ? "s" : ""}</p>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-paper-edge p-10 text-center">
          <p className="font-mono text-sm text-ink-soft">Queue is clear.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <ModerationCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

type Item = Awaited<ReturnType<typeof prisma.moderationItem.findMany>>[number] & {
  report: { reporter: { githubLogin: string | null } } | null;
  application: { applicant: { githubLogin: string | null }; role: { title: string } } | null;
  announcement: { title: string; body: string; project: { slug: string; title: string } } | null;
};

const VERDICT_STYLES: Record<string, string> = {
  clean: "bg-[#d9efe6] text-pin-teal",
  borderline: "bg-[#fff8e1] text-pin-gold",
  spam: "bg-[#f4ded9] text-pin-red",
};

function ModerationCard({ item }: { item: Item }) {
  async function approve() {
    "use server";
    const { auth: getAuth } = await import("@/lib/auth");
    const s = await getAuth();
    if (!s?.user?.id) return;
    const admin = await prisma.user.findUnique({ where: { id: s.user.id } });
    if (!admin?.isAdmin) return;

    await prisma.$transaction(async (tx) => {
      await tx.moderationItem.update({
        where: { id: item.id },
        data: { decidedById: s.user.id, decidedAt: new Date() },
      });
      if (item.subjectType === "project") {
        await tx.project.updateMany({
          where: { id: item.subjectId, moderationStatus: "held" },
          data: { moderationStatus: "published" },
        });
      } else if (item.subjectType === "announcement") {
        await tx.announcement.updateMany({
          where: { id: item.subjectId, moderationStatus: "held" },
          data: { moderationStatus: "published" },
        });
      } else if (item.subjectType === "application") {
        await tx.application.updateMany({
          where: { id: item.subjectId, moderationStatus: "held" },
          data: { moderationStatus: "published" },
        });
      }
    });

    const { redirect: redir } = await import("next/navigation");
    redir("/admin/moderation");
  }

  async function remove() {
    "use server";
    const { auth: getAuth } = await import("@/lib/auth");
    const s = await getAuth();
    if (!s?.user?.id) return;
    const admin = await prisma.user.findUnique({ where: { id: s.user.id } });
    if (!admin?.isAdmin) return;

    await prisma.$transaction(async (tx) => {
      await tx.moderationItem.update({
        where: { id: item.id },
        data: { decidedById: s.user.id, decidedAt: new Date() },
      });
      if (item.subjectType === "project") {
        await tx.project.updateMany({
          where: { id: item.subjectId },
          data: { moderationStatus: "removed" },
        });
      } else if (item.subjectType === "announcement") {
        await tx.announcement.updateMany({
          where: { id: item.subjectId },
          data: { moderationStatus: "removed" },
        });
      } else if (item.subjectType === "application") {
        await tx.application.updateMany({
          where: { id: item.subjectId },
          data: { moderationStatus: "removed" },
        });
      }
    });

    const { redirect: redir } = await import("next/navigation");
    redir("/admin/moderation");
  }

  return (
    <div className="rounded-lg border border-paper-edge bg-paper p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="rounded-sm bg-ink px-1.5 py-0.5 font-mono text-[0.62rem] uppercase text-paper">
          {item.subjectType}
        </span>
        {item.verdict && (
          <span className={`rounded-full px-2 py-0.5 font-mono text-xs ${VERDICT_STYLES[item.verdict] ?? ""}`}>
            {item.verdict}
            {item.confidence != null && ` (${Math.round(item.confidence * 100)}%)`}
          </span>
        )}
        {!item.verdict && item.report && (
          <span className="rounded-full bg-board px-2 py-0.5 font-mono text-xs text-ink-soft">
            user report
          </span>
        )}
      </div>

      {item.subjectType === "announcement" && item.announcement && (
        <div className="mb-3">
          <p className="font-semibold text-sm text-ink">{item.announcement.title}</p>
          <p className="text-sm text-ink/70 mt-0.5 line-clamp-2">{item.announcement.body}</p>
          <p className="font-mono text-xs text-ink-soft mt-1">
            from {item.announcement.project.title}
          </p>
        </div>
      )}

      {item.subjectType === "application" && item.application && (
        <div className="mb-3">
          <p className="font-semibold text-sm text-ink">
            @{item.application.applicant.githubLogin} → {item.application.role.title}
          </p>
        </div>
      )}

      {item.subjectType === "project" && (
        <div className="mb-3">
          <p className="font-semibold text-sm text-ink">Project ID: {item.subjectId}</p>
        </div>
      )}

      {item.reasons && (
        <p className="font-mono text-xs text-ink-soft mb-3 italic">{item.reasons}</p>
      )}

      {item.report && (
        <p className="font-mono text-xs text-ink-soft mb-3">
          Reported by @{item.report.reporter.githubLogin} ·{" "}
          {new Date(item.createdAt).toLocaleDateString()}
        </p>
      )}

      <div className="flex gap-2">
        <form action={approve}>
          <button
            type="submit"
            className="rounded-md bg-pin-teal px-4 py-1.5 font-mono text-xs text-white shadow-[0_2px_0_#0e5a47] hover:-translate-y-px"
          >
            Approve (publish)
          </button>
        </form>
        <form action={remove}>
          <button
            type="submit"
            className="rounded-md border border-paper-edge px-4 py-1.5 font-mono text-xs text-ink-soft hover:border-ink-soft hover:text-pin-red"
          >
            Remove
          </button>
        </form>
      </div>
    </div>
  );
}
