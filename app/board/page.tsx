import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { BoardQuerySchema } from "@/lib/validators";
import { Header } from "@/components/Header";

interface Props {
  searchParams: Promise<Record<string, string>>;
}

const BOOST_ENABLED = process.env.BOOST_ENABLED === "true";

function findProjects(args: Parameters<typeof prisma.project.findMany>[0]) {
  return prisma.project.findMany({
    ...args,
    include: { tags: true, roles: { where: { status: "open" } } },
  });
}
type BoardProject = Awaited<ReturnType<typeof findProjects>>[number];

async function getBoard(query: {
  q?: string;
  tag?: string;
  stage?: string;
  sort?: string;
}) {
  const sort = query.sort ?? "latest";
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const now = new Date();

  const where = {
    moderationStatus: "published" as const,
    ...(query.stage ? { stage: query.stage as never } : {}),
    ...(query.tag ? { tags: { some: { tag: query.tag } } } : {}),
    ...(query.q
      ? {
          OR: [
            { title: { contains: query.q, mode: "insensitive" as const } },
            { pitch: { contains: query.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const announcementsQuery = prisma.announcement.findMany({
    where: { moderationStatus: "published", publishedAt: { not: null } },
    orderBy: { publishedAt: "desc" },
    take: 10,
    include: { project: { select: { slug: true, title: true } } },
  });

  const nonBoostedWhere = BOOST_ENABLED
    ? { ...where, OR: [{ boostedUntil: null }, { boostedUntil: { lte: now } }] }
    : where;

  const boostedQuery = findProjects({
    where: { ...where, boostedUntil: { gt: now } },
    orderBy: { boostedUntil: "desc" },
    take: BOOST_ENABLED ? 6 : 0,
  });

  if (sort === "trending") {
    const [boosted, rows, trendCounts, announcements] = await Promise.all([
      boostedQuery,
      findProjects({ where: nonBoostedWhere, orderBy: { createdAt: "desc" }, take: 100 }),
      prisma.contributionEvent.groupBy({
        by: ["projectId"],
        where: { occurredAt: { gte: weekAgo } },
        _count: { _all: true },
      }),
      announcementsQuery,
    ]);
    const countMap = new Map(trendCounts.map((r) => [r.projectId, r._count._all]));
    const projects = [...rows]
      .sort((a, b) => (countMap.get(b.id) ?? 0) - (countMap.get(a.id) ?? 0))
      .slice(0, 40);
    return { boosted, projects, announcements };
  }

  const [boosted, projects, announcements] = await Promise.all([
    boostedQuery,
    findProjects({
      where: nonBoostedWhere,
      orderBy: sort === "popular" ? { memberships: { _count: "desc" } } : { createdAt: "desc" },
      take: 40,
    }),
    announcementsQuery,
  ]);

  return { boosted, projects, announcements };
}

const PIN_COLORS: Record<string, { dot: string; strong: string }> = {
  red: {
    dot: "bg-pin-red shadow-[inset_-2px_-2px_3px_rgba(0,0,0,.35)]",
    strong: "text-pin-red",
  },
  teal: {
    dot: "bg-pin-teal shadow-[inset_-2px_-2px_3px_rgba(0,0,0,.35)]",
    strong: "text-pin-teal",
  },
  gold: {
    dot: "bg-pin-gold shadow-[inset_-2px_-2px_3px_rgba(0,0,0,.35)]",
    strong: "text-pin-gold",
  },
};

function pinColor(index: number) {
  const keys = ["red", "teal", "gold"];
  return PIN_COLORS[keys[index % 3]];
}

function rotationClass(index: number) {
  const rotations = ["-rotate-1", "rotate-1", "-rotate-0.5", "rotate-0.5"];
  return rotations[index % rotations.length];
}

export default async function BoardPage({ searchParams }: Props) {
  const params = BoardQuerySchema.parse(await searchParams);
  const { boosted, projects, announcements } = await getBoard(params);

  const allTags = [
    ...new Set(projects.flatMap((p) => p.tags.map((t) => t.tag))),
  ].sort();

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-5 pb-16">
        {/* Boosted projects */}
        {BOOST_ENABLED && boosted.length > 0 && (
          <section className="mt-8 mb-6">
            <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-pin-gold">
              ⚡ Featured
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {boosted.map((project, i) => {
                const colors = pinColor(i);
                return (
                  <Link
                    key={project.id}
                    href={`/p/${project.slug}`}
                    className={`group relative rounded-sm bg-paper p-5 pt-6 ring-2 ring-pin-gold/60 shadow-[0_8px_18px_rgba(0,0,0,.22)] transition-[transform,box-shadow] duration-150 hover:scale-[1.02] hover:shadow-[0_14px_26px_rgba(0,0,0,.3)]`}
                  >
                    <span
                      className={`absolute -top-2 left-1/2 -translate-x-1/2 h-4 w-4 rounded-full ${colors.dot}`}
                      aria-hidden="true"
                    />
                    <span className="absolute top-2 right-2 rounded-sm bg-pin-gold px-1.5 py-0.5 font-mono text-[0.6rem] font-semibold text-ink uppercase tracking-wide">
                      boosted
                    </span>
                    <p className="mb-1.5 truncate font-mono text-xs text-ink-soft">
                      github.com/{project.repoFullName}
                    </p>
                    <h3 className="mb-2 font-display font-semibold text-base leading-snug text-ink">
                      {project.title}
                    </h3>
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {project.tags.map((t) => (
                        <span key={t.tag} className="rounded-sm bg-paper-edge px-1.5 py-0.5 font-mono text-[0.64rem] text-ink-soft">
                          {t.tag}
                        </span>
                      ))}
                      <span className="rounded-sm bg-paper-edge px-1.5 py-0.5 font-mono text-[0.64rem] text-ink-soft">
                        {project.stage}
                      </span>
                    </div>
                    {project.roles.length > 0 && (
                      <p className="border-t border-dashed border-paper-edge pt-2.5 text-[0.8rem] text-ink">
                        <strong className={`font-semibold ${colors.strong}`}>Needs:</strong>{" "}
                        {project.roles.map((r) => r.title).join(" · ")}
                      </p>
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Fresh off the board */}
        {announcements.length > 0 && (
          <section className="mt-8 mb-6">
            <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-pin-gold">
              Fresh off the board
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-3">
              {announcements.map((a) => (
                <Link
                  key={a.id}
                  href={`/p/${a.project.slug}`}
                  className="flex-shrink-0 max-w-[280px] rounded-lg border border-ink/14 bg-ink/5 px-4 py-3 hover:bg-ink/8"
                >
                  <p className="mb-1 font-mono text-[0.64rem] text-pin-gold">
                    {a.project.slug} · {a.kind.replace("_", " ")}
                  </p>
                  <p className="text-sm font-semibold text-ink">{a.title}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Sort tabs */}
        <div className="mb-4 flex gap-1 border-b border-ink/10 pb-0">
          {(["latest", "trending", "popular"] as const).map((s) => {
            const active = (params.sort ?? "latest") === s;
            const qs = buildQuery({ ...params, sort: s });
            return (
              <Link
                key={s}
                href={`/board${qs}`}
                className={`-mb-px rounded-t-md border border-b-0 px-4 py-2 font-mono text-xs transition-colors ${
                  active
                    ? "border-ink/15 bg-paper text-ink font-medium"
                    : "border-transparent text-ink-soft hover:text-ink"
                }`}
              >
                {s === "latest" && "⏱ latest"}
                {s === "trending" && "🔥 trending"}
                {s === "popular" && "⭐ popular"}
              </Link>
            );
          })}
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-2">
          <FilterChip href={`/board${buildQuery({ sort: params.sort })}`} active={!params.tag && !params.stage && !params.q} label="all" />
          {allTags.map((tag) => (
            <FilterChip
              key={tag}
              href={`/board${buildQuery({ ...params, tag })}`}
              active={params.tag === tag}
              label={tag}
            />
          ))}
          {(["building", "prototype", "launched"] as const).map((s) => (
            <FilterChip
              key={s}
              href={`/board${buildQuery({ ...params, stage: s })}`}
              active={params.stage === s}
              label={s}
            />
          ))}
        </div>

        {/* Search */}
        <form method="GET" action="/board" className="mb-8">
          {params.sort && params.sort !== "latest" && (
            <input type="hidden" name="sort" value={params.sort} />
          )}
          <input
            type="search"
            name="q"
            defaultValue={params.q}
            placeholder="Search projects…"
            className="w-full max-w-sm rounded-lg border border-paper-edge bg-paper px-4 py-2.5 font-mono text-sm text-ink placeholder:text-ink-soft focus:outline-2 focus:outline-pin-gold"
          />
        </form>

        {/* Cards */}
        {projects.length === 0 ? (
          <p className="py-16 text-center font-mono text-sm text-ink-soft">
            No projects match that filter.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project, i) => {
              const colors = pinColor(i);
              return (
                <Link
                  key={project.id}
                  href={`/p/${project.slug}`}
                  className={`group relative rounded-sm bg-paper p-5 pt-6 shadow-[0_8px_18px_rgba(0,0,0,.22),0_2px_5px_rgba(0,0,0,.1)] transition-[transform,box-shadow] duration-150 hover:rotate-0 hover:scale-[1.03] hover:shadow-[0_14px_26px_rgba(0,0,0,.3)] ${rotationClass(i)}`}
                >
                  {/* Pin */}
                  <span
                    className={`absolute -top-2 left-1/2 -translate-x-1/2 h-4 w-4 rounded-full ${colors.dot}`}
                    aria-hidden="true"
                  />
                  <p className="mb-1.5 truncate font-mono text-xs text-ink-soft">
                    github.com/{project.repoFullName}
                  </p>
                  <h3 className="mb-2 font-display font-semibold text-base leading-snug text-ink">
                    {project.title}
                  </h3>
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {project.tags.map((t) => (
                      <span
                        key={t.tag}
                        className="rounded-sm bg-paper-edge px-1.5 py-0.5 font-mono text-[0.64rem] text-ink-soft"
                      >
                        {t.tag}
                      </span>
                    ))}
                    <span className="rounded-sm bg-paper-edge px-1.5 py-0.5 font-mono text-[0.64rem] text-ink-soft">
                      {project.stage}
                    </span>
                  </div>
                  {project.roles.length > 0 && (
                    <p className="border-t border-dashed border-paper-edge pt-2.5 text-[0.8rem] text-ink">
                      <strong className={`font-semibold ${colors.strong}`}>
                        Needs:
                      </strong>{" "}
                      {project.roles.map((r) => r.title).join(" · ")}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}

function buildQuery(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== "");
  if (entries.length === 0) return "";
  return "?" + new URLSearchParams(entries as [string, string][]).toString();
}

function FilterChip({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1.5 font-mono text-[0.74rem] transition-colors ${
        active
          ? "border-pin-gold bg-pin-gold text-ink font-medium"
          : "border-ink/25 text-ink hover:border-ink/50"
      }`}
    >
      {label}
    </Link>
  );
}
