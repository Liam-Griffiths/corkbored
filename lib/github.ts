// All GitHub API calls live here. Nothing outside this file imports octokit.
// Task 3.1 (GitHub App) is a HUMAN TASK — verifyRepoForUser is stubbed until then.

export type RepoVerifyResult =
  | { ok: true; repoId: string; defaultBranch: string; license: string | null }
  | { ok: false; reason: "not_found" | "no_permission" | "not_enough_commits" | "not_implemented" };

export async function verifyRepoForUser(
  _repoFullName: string,
  _githubLogin: string,
): Promise<RepoVerifyResult> {
  // TODO (Task 3.1): implement with GitHub App + octokit once credentials are set
  // For now, stub passes verification so the create-project form can be built and tested
  return { ok: false, reason: "not_implemented" };
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
