// All GitHub API calls live here.

export type RepoVerifyResult =
  | { ok: true; repoId: string; defaultBranch: string; license: string | null; name: string; description: string | null }
  | { ok: false; reason: "not_found" | "no_permission" | "not_enough_commits" | "private_repo" };

function githubHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) h["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

export async function verifyRepoForUser(
  repoFullName: string,
  githubLogin: string,
): Promise<RepoVerifyResult> {
  const headers = githubHeaders();

  const res = await fetch(`https://api.github.com/repos/${repoFullName}`, { headers, next: { revalidate: 0 } });
  if (res.status === 404) return { ok: false, reason: "not_found" };
  if (!res.ok) return { ok: false, reason: "not_found" };

  const repo = await res.json();

  if (repo.private) return { ok: false, reason: "private_repo" };
  if (repo.owner?.login?.toLowerCase() !== githubLogin.toLowerCase()) {
    return { ok: false, reason: "no_permission" };
  }

  // Require at least one commit
  const commitsRes = await fetch(
    `https://api.github.com/repos/${repoFullName}/commits?per_page=1`,
    { headers, next: { revalidate: 0 } },
  );
  const commits = commitsRes.ok ? await commitsRes.json() : [];
  if (!Array.isArray(commits) || commits.length === 0) {
    return { ok: false, reason: "not_enough_commits" };
  }

  return {
    ok: true,
    repoId: String(repo.id),
    defaultBranch: repo.default_branch ?? "main",
    license: repo.license?.spdx_id ?? null,
    name: repo.name as string,
    description: (repo.description as string | null) ?? null,
  };
}

export type InviteResult =
  | { ok: true }
  | { ok: false; reason: string };

export async function inviteCollaborator(
  _repoFullName: string,
  _githubLogin: string,
): Promise<InviteResult> {
  // TODO (Task 4.4): implement with GitHub App once credentials are set
  // Caller handles failure — shows owner a manual-fallback banner
  return { ok: false, reason: "GitHub App not configured yet" };
}
