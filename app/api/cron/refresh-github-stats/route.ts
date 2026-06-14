import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Refresh GithubStats for users active in the last 30 days
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const activeUserIds = await prisma.membership.findMany({
    where: { joinedAt: { gte: since }, leftAt: null },
    select: { userId: true },
    distinct: ["userId"],
  });

  const userIds = activeUserIds.map((m) => m.userId);

  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, githubLogin: { not: null } },
    select: { id: true, githubLogin: true, githubId: true },
  });

  let refreshed = 0;
  for (const user of users) {
    if (!user.githubLogin) continue;
    try {
      const stats = await fetchGithubStats(user.githubLogin);
      if (!stats) continue;

      await prisma.githubStats.upsert({
        where: { userId: user.id },
        update: {
          accountAgeYears: stats.accountAgeYears,
          publicRepos: stats.publicRepos,
          commitsLast90d: stats.commitsLast90d,
          topLanguages: stats.topLanguages,
          refreshedAt: new Date(),
        },
        create: {
          userId: user.id,
          accountAgeYears: stats.accountAgeYears,
          publicRepos: stats.publicRepos,
          commitsLast90d: stats.commitsLast90d,
          topLanguages: stats.topLanguages,
          refreshedAt: new Date(),
        },
      });
      refreshed++;
    } catch {
      // non-fatal — skip this user and continue
    }
  }

  return Response.json({ refreshed, total: users.length });
}

async function fetchGithubStats(login: string): Promise<{
  accountAgeYears: number;
  publicRepos: number;
  commitsLast90d: number | null;
  topLanguages: string[];
} | null> {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const userRes = await fetch(`https://api.github.com/users/${login}`, { headers });
  if (!userRes.ok) return null;

  const userData = await userRes.json() as {
    created_at: string;
    public_repos: number;
  };

  const createdAt = new Date(userData.created_at);
  const accountAgeYears = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24 * 365);

  // Top languages: scan their repos
  const reposRes = await fetch(
    `https://api.github.com/users/${login}/repos?per_page=30&sort=pushed`,
    { headers },
  );
  const repos = reposRes.ok ? await reposRes.json() as Array<{ language: string | null }> : [];
  const langCounts: Record<string, number> = {};
  for (const repo of repos) {
    if (repo.language) langCounts[repo.language] = (langCounts[repo.language] ?? 0) + 1;
  }
  const topLanguages = Object.entries(langCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([lang]) => lang);

  return {
    accountAgeYears: Math.round(accountAgeYears * 10) / 10,
    publicRepos: userData.public_repos,
    commitsLast90d: null, // requires authenticated search — skipped without GITHUB_TOKEN scope
    topLanguages,
  };
}
