import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { BoardQuerySchema } from "@/lib/validators";
import { Header } from "@/components/Header";

interface Props {
  searchParams: Promise<Record<string, string>>;
}

async function getBoard(query: {
  q?: string;
  tag?: string;
  stage?: string;
}) {
  const where = {
    moderationStatus: "published" as const,
    ...(query.stage ? { stage: query.stage as never } : {}),
    ...(query.tag
      ? { tags: { some: { tag: query.tag } } }
      : {}),
    ...(query.q
      ? {
          OR: [
            { title: { contains: query.q, mode: "insensitive" as const } },
            { pitch: { contains: query.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [projects, announcements] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { tags: true, roles: { where: { status: "open" } } },
      take: 40,
    }),
    prisma.announcement.findMany({
      where: { moderationStatus: "published", publishedAt: { not: null } },
      orderBy: { publishedAt: "desc" },
      take: 10,
      include: { project: { select: { slug: true, title: true } } },
    }),
  ]);

  return { projects, announcements };
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
  const { projects, announcements } = await getBoard(params);

  const allTags = [
    ...new Set(projects.flatMap((p) => p.tags.map((t) => t.tag))),
  ].sort();

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-5 pb-16">
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

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-2">
          <FilterChip href="/board" active={!params.tag && !params.stage && !params.q} label="all" />
          {allTags.map((tag) => (
            <FilterChip
              key={tag}
              href={`/board?tag=${encodeURIComponent(tag)}`}
              active={params.tag === tag}
              label={tag}
            />
          ))}
          {(["building", "prototype", "launched"] as const).map((s) => (
            <FilterChip
              key={s}
              href={`/board?stage=${s}`}
              active={params.stage === s}
              label={s}
            />
          ))}
        </div>

        {/* Search */}
        <form method="GET" action="/board" className="mb-8">
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
