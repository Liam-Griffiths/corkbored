import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Header } from "@/components/Header";
import { FollowButton } from "@/components/FollowButton";
import { ShareButtons } from "@/components/ShareButtons";
import { getOrCreateUserShortlink } from "@/lib/shortlink";

interface Props {
  params: Promise<{ githubLogin: string }>;
}

async function getProfile(githubLogin: string) {
  return prisma.user.findUnique({
    where: { githubLogin },
    select: {
      id: true,
      displayName: true,
      githubLogin: true,
      avatarUrl: true,
      availability: true,
      hoursPerWeek: true,
      lookingFor: true,
      createdAt: true,
      skills: { select: { skill: true } },
      githubStats: {
        select: { publicRepos: true, commitsLast90d: true, topLanguages: true, accountAgeYears: true },
      },
      memberships: {
        where: { leftAt: null },
        include: {
          project: {
            select: { id: true, slug: true, title: true, stage: true, moderationStatus: true },
          },
        },
        orderBy: { joinedAt: "asc" },
      },
      ownedProjects: {
        where: { moderationStatus: { not: "removed" } },
        select: { id: true, slug: true, title: true, stage: true },
        orderBy: { createdAt: "desc" },
      },
      links: {
        orderBy: { position: "asc" },
        select: { id: true, label: true, url: true },
      },
      _count: {
        select: { followers: true, following: true },
      },
    },
  });
}

export default async function ProfilePage({ params }: Props) {
  const { githubLogin } = await params;
  const [profile, session] = await Promise.all([getProfile(githubLogin), auth()]);

  if (!profile) notFound();

  const userId = session?.user?.id;
  const isOwn = userId === profile.id;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://corkbored.com";

  const [isFollowing, shortCode] = await Promise.all([
    userId && !isOwn
      ? prisma.userFollow
          .findUnique({ where: { followerId_followingId: { followerId: userId, followingId: profile.id } } })
          .then((f) => !!f)
      : Promise.resolve(false),
    getOrCreateUserShortlink(profile.id),
  ]);

  const followerCount = profile._count.followers;

  const displayName = profile.displayName ?? profile.githubLogin ?? "Unknown";
  const topLangs = Array.isArray(profile.githubStats?.topLanguages)
    ? (profile.githubStats.topLanguages as string[]).slice(0, 5)
    : [];

  const activeProjects = profile.memberships
    .filter((m) => m.project.moderationStatus !== "removed")
    .map((m) => m.project);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-5 py-10">
        <Link href="/board" className="mb-8 inline-block font-mono text-sm text-ink-soft hover:text-ink">
          ← back to the board
        </Link>

        {/* Profile card */}
        <div className="rounded-sm bg-paper shadow-[0_14px_30px_rgba(0,0,0,.18)] p-8 mb-6">
          <div className="flex flex-wrap items-start gap-6">
            {/* Avatar */}
            <div className="flex-shrink-0">
              {profile.avatarUrl ? (
                <Image
                  src={profile.avatarUrl}
                  alt={displayName}
                  width={80}
                  height={80}
                  className="rounded-full"
                />
              ) : (
                <div className="h-20 w-20 rounded-full bg-pin-gold flex items-center justify-center font-display font-bold text-2xl text-ink">
                  {displayName[0].toUpperCase()}
                </div>
              )}
            </div>

            {/* Identity */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3 mb-1">
                <h1 className="font-display font-bold text-2xl text-ink">{displayName}</h1>
                {userId && !isOwn && (
                  <FollowButton
                    endpoint={`/api/users/${profile.githubLogin}/follow`}
                    initialFollowing={isFollowing}
                    initialCount={followerCount}
                  />
                )}
                <ShareButtons
                  shortUrl={`${appUrl}/${shortCode}`}
                  title={`${displayName} on Corkbored`}
                />
              </div>
              <a
                href={`https://github.com/${profile.githubLogin}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm text-ink-soft hover:text-ink"
              >
                @{profile.githubLogin}
              </a>

              <div className="mt-3 flex flex-wrap gap-4 font-mono text-xs text-ink-soft">
                <span>{followerCount} followers</span>
                <span>{profile._count.following} following</span>
                {profile.githubStats?.publicRepos != null && (
                  <span>{profile.githubStats.publicRepos} public repos</span>
                )}
                {profile.githubStats?.commitsLast90d != null && (
                  <span>{profile.githubStats.commitsLast90d} commits (90d)</span>
                )}
              </div>
            </div>
          </div>

          {/* Availability + looking for */}
          {(profile.availability || profile.lookingFor || profile.hoursPerWeek != null) && (
            <div className="mt-6 pt-6 border-t border-paper-edge grid grid-cols-1 gap-3 sm:grid-cols-3">
              {profile.availability && (
                <div>
                  <p className="font-mono text-[0.65rem] uppercase tracking-widest text-ink-soft mb-0.5">Status</p>
                  <p className="text-sm text-ink">{profile.availability}</p>
                </div>
              )}
              {profile.hoursPerWeek != null && (
                <div>
                  <p className="font-mono text-[0.65rem] uppercase tracking-widest text-ink-soft mb-0.5">Hours/week</p>
                  <p className="text-sm text-ink">{profile.hoursPerWeek}h</p>
                </div>
              )}
              {profile.lookingFor && (
                <div>
                  <p className="font-mono text-[0.65rem] uppercase tracking-widest text-ink-soft mb-0.5">Looking for</p>
                  <p className="text-sm text-ink">{profile.lookingFor}</p>
                </div>
              )}
            </div>
          )}

          {/* Skills */}
          {profile.skills.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-1.5">
              {profile.skills.map((s) => (
                <span
                  key={s.skill}
                  className="rounded-sm bg-paper-edge px-2 py-0.5 font-mono text-xs text-ink-soft"
                >
                  {s.skill}
                </span>
              ))}
            </div>
          )}

          {/* Top languages */}
          {topLangs.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {topLangs.map((lang) => (
                <span
                  key={lang}
                  className="rounded-sm bg-pin-teal/10 px-2 py-0.5 font-mono text-xs text-pin-teal"
                >
                  {lang}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* My links */}
        {profile.links.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-ink-soft">Links</h2>
            <div className="flex flex-wrap gap-2">
              {profile.links.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-md border border-paper-edge px-3 py-1.5 font-mono text-xs text-ink-soft hover:border-ink-soft hover:text-ink transition-colors"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                  {link.label}
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Projects */}
        {activeProjects.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-ink-soft">Projects</h2>
            <div className="space-y-2">
              {activeProjects.map((p) => (
                <Link
                  key={p.id}
                  href={`/p/${p.slug}`}
                  className="flex items-center justify-between rounded-lg border border-paper-edge bg-paper px-4 py-3 hover:border-ink-soft transition-colors"
                >
                  <span className="font-medium text-sm text-ink">{p.title}</span>
                  <span
                    className={`rounded-sm px-2 py-0.5 font-mono text-[0.62rem] uppercase tracking-wide text-white ${
                      p.stage === "launched"
                        ? "bg-pin-red"
                        : p.stage === "prototype"
                          ? "bg-pin-gold text-ink"
                          : "bg-pin-teal"
                    }`}
                  >
                    {p.stage}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {activeProjects.length === 0 && (
          <p className="rounded-lg border border-dashed border-paper-edge p-6 text-center font-mono text-sm text-ink-soft">
            No projects yet.
          </p>
        )}
      </main>
    </>
  );
}
