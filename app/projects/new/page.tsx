import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { verifyRepoForUser } from "@/lib/github";
import { upsertTagsByLabel, getPopularTags } from "@/lib/tags";
import { limitsFor, tierForUser } from "@/lib/limits";
import { Header } from "@/components/Header";

interface Props {
  searchParams: Promise<Record<string, string>>;
}

export default async function NewProjectPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin?callbackUrl=/projects/new");

  const githubLogin = session.user.githubLogin;
  const params = await searchParams;
  const errorKey = params.error ?? null;
  if (!githubLogin) redirect("/me");

  async function createProject(formData: FormData) {
    "use server";

    const s = await auth();
    if (!s?.user?.id || !s.user.githubLogin) return;

    // Cap how many projects a user can own, based on their tier.
    const maxProjects = limitsFor(await tierForUser(s.user.id)).projects;
    const ownedCount = await prisma.project.count({
      where: { ownerId: s.user.id, moderationStatus: { not: "removed" } },
    });
    if (ownedCount >= maxProjects) {
      redirect("/projects/new?error=project_limit");
    }

    const repoRaw = (formData.get("repoFullName") as string).trim().replace(/^https?:\/\/github\.com\//, "");
    const title = (formData.get("title") as string).trim();
    const pitch = (formData.get("pitch") as string).trim() || null;
    const stage = (formData.get("stage") as string) || "building";
    const tagsRaw = (formData.get("tags") as string)
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 10);

    const roleInputs = [1, 2, 3]
      .map((i) => ({
        title: (formData.get(`role_title_${i}`) as string | null)?.trim() ?? "",
        detail: (formData.get(`role_detail_${i}`) as string | null)?.trim() || null,
      }))
      .filter((r) => r.title.length > 0);

    if (!repoRaw || !title || roleInputs.length === 0) {
      redirect("/projects/new?error=missing_fields");
    }

    const verify = await verifyRepoForUser(repoRaw, s.user.githubLogin);
    if (!verify.ok) {
      redirect(`/projects/new?error=${verify.reason}&repo=${encodeURIComponent(repoRaw)}`);
    }

    // Slug: prefer repo name, fall back to owner-repo
    const baseSlug = repoRaw.split("/")[1]
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const exists = await prisma.project.findUnique({ where: { slug: baseSlug }, select: { id: true } });
    const slug = exists ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug;

    const newProject = await prisma.$transaction(async (tx) => {
      const tagIds = await upsertTagsByLabel(tx, tagsRaw);
      const project = await tx.project.create({
        data: {
          slug,
          title,
          pitch,
          repoId: verify.repoId,
          repoFullName: repoRaw,
          stage: stage as never,
          defaultBranch: verify.defaultBranch,
          license: verify.license,
          ownerId: s.user.id,
          tags: { create: tagIds.map((tagId) => ({ tagId })) },
          roles: { create: roleInputs },
        },
      });

      await tx.membership.create({
        data: { projectId: project.id, userId: s.user.id, role: "owner" },
      });

      return project;
    });

    // Notify followers of the owner that they pinned a new project
    const ownerFollowers = await prisma.userFollow.findMany({
      where: { followingId: s.user.id },
      select: { followerId: true },
    });
    if (ownerFollowers.length > 0) {
      await prisma.notification.createMany({
        data: ownerFollowers.map((f) => ({
          userId: f.followerId,
          kind: "new_project" as const,
          projectId: newProject.id,
        })),
      });
    }

    redirect(`/p/${slug}/dashboard`);
  }

  const popularTags = await getPopularTags();

  const errorMessages: Record<string, string> = {
    missing_fields: "Please fill in all required fields and add at least one role.",
    project_limit: "You've reached the project limit for your plan. Upgrade to pin more.",
    not_found: "Repo not found on GitHub. Check the name and make sure it's public.",
    no_permission: "That repo doesn't belong to your GitHub account.",
    not_enough_commits: "The repo needs at least one commit before you can pin it.",
    private_repo: "Private repos aren't supported yet — your repo must be public.",
  };

  return (
    <>
      <Header />
      <main className="mx-auto max-w-2xl px-5 py-10">
        <div className="mb-8">
          <h1 className="font-display font-bold text-3xl text-ink">Pin a project</h1>
          <p className="mt-2 font-mono text-sm text-ink-soft">
            Public repos only · private repos coming later
          </p>
        </div>

        {errorKey && errorMessages[errorKey] && (
          <div className="mb-6 rounded-md border border-pin-red/40 bg-pin-red/8 px-4 py-3 font-mono text-sm text-pin-red">
            {errorMessages[errorKey]}
          </div>
        )}

        <form action={createProject} className="space-y-8">
          {/* Repo */}
          <section className="rounded-sm bg-paper p-6 shadow-[0_8px_18px_rgba(0,0,0,.18)]">
            <h2 className="mb-4 font-display font-semibold text-lg text-ink">Your repo</h2>
            <div>
              <label htmlFor="repoFullName" className="mb-1 block font-mono text-xs uppercase tracking-widest text-ink-soft">
                GitHub repo <span className="text-pin-red">*</span>
              </label>
              <input
                id="repoFullName"
                name="repoFullName"
                required
                placeholder="owner/repo or https://github.com/owner/repo"
                className="w-full rounded-md border border-paper-edge bg-paper-bright px-3 py-2 font-mono text-sm text-ink placeholder:text-ink-soft focus:outline-2 focus:outline-pin-gold"
              />
              <p className="mt-1 font-mono text-[0.7rem] text-ink-soft">
                Must be public and owned by @{githubLogin}. Needs at least one commit.
              </p>
            </div>
          </section>

          {/* Project details */}
          <section className="rounded-sm bg-paper p-6 shadow-[0_8px_18px_rgba(0,0,0,.18)]">
            <h2 className="mb-4 font-display font-semibold text-lg text-ink">Project details</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="title" className="mb-1 block font-mono text-xs uppercase tracking-widest text-ink-soft">
                  Title <span className="text-pin-red">*</span>
                </label>
                <input
                  id="title"
                  name="title"
                  required
                  maxLength={120}
                  placeholder="e.g. Open-source budgeting for freelancers"
                  className="w-full rounded-md border border-paper-edge bg-paper-bright px-3 py-2 font-sans text-sm text-ink placeholder:text-ink-soft focus:outline-2 focus:outline-pin-gold"
                />
              </div>
              <div>
                <label htmlFor="pitch" className="mb-1 block font-mono text-xs uppercase tracking-widest text-ink-soft">
                  Pitch
                </label>
                <textarea
                  id="pitch"
                  name="pitch"
                  rows={3}
                  maxLength={600}
                  placeholder="What are you building and why? What makes it interesting?"
                  className="w-full resize-y rounded-md border border-paper-edge bg-paper-bright px-3 py-2 font-sans text-sm text-ink placeholder:text-ink-soft focus:outline-2 focus:outline-pin-gold"
                />
              </div>
              <div>
                <label htmlFor="stage" className="mb-1 block font-mono text-xs uppercase tracking-widest text-ink-soft">
                  Stage
                </label>
                <select
                  id="stage"
                  name="stage"
                  className="rounded-md border border-paper-edge bg-paper-bright px-3 py-2 font-mono text-sm text-ink focus:outline-2 focus:outline-pin-gold"
                >
                  <option value="building">building</option>
                  <option value="prototype">prototype</option>
                  <option value="launched">launched</option>
                </select>
              </div>
              <div>
                <label htmlFor="tags" className="mb-1 block font-mono text-xs uppercase tracking-widest text-ink-soft">
                  Tech tags
                </label>
                <input
                  id="tags"
                  name="tags"
                  list="tag-suggestions"
                  placeholder="e.g. typescript, rust, postgres"
                  className="w-full rounded-md border border-paper-edge bg-paper-bright px-3 py-2 font-mono text-sm text-ink placeholder:text-ink-soft focus:outline-2 focus:outline-pin-gold"
                />
                <datalist id="tag-suggestions">
                  {popularTags.map((t) => (
                    <option key={t.slug} value={t.slug} />
                  ))}
                </datalist>
                <p className="mt-1 font-mono text-[0.7rem] text-ink-soft">Comma-separated · up to 10</p>
              </div>
            </div>
          </section>

          {/* Roles */}
          <section className="rounded-sm bg-paper p-6 shadow-[0_8px_18px_rgba(0,0,0,.18)]">
            <h2 className="mb-1 font-display font-semibold text-lg text-ink">Open roles</h2>
            <p className="mb-4 font-mono text-xs text-ink-soft">At least one required. Add more from your dashboard later.</p>
            <div className="space-y-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-md border border-paper-edge p-4">
                  <p className="mb-3 font-mono text-xs text-ink-soft uppercase tracking-widest">
                    Role {i} {i === 1 && <span className="text-pin-red">*</span>}
                  </p>
                  <div className="space-y-3">
                    <input
                      name={`role_title_${i}`}
                      placeholder={i === 1 ? "e.g. Frontend engineer" : "Role title (optional)"}
                      required={i === 1}
                      maxLength={80}
                      className="w-full rounded-md border border-paper-edge bg-paper-bright px-3 py-2 font-sans text-sm text-ink placeholder:text-ink-soft focus:outline-2 focus:outline-pin-gold"
                    />
                    <input
                      name={`role_detail_${i}`}
                      placeholder="Details · time commitment · skills needed"
                      maxLength={300}
                      className="w-full rounded-md border border-paper-edge bg-paper-bright px-3 py-2 font-sans text-sm text-ink placeholder:text-ink-soft focus:outline-2 focus:outline-pin-gold"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <button
            type="submit"
            className="w-full rounded-md bg-pin-red px-5 py-3 font-mono text-sm font-medium text-white shadow-[0_3px_0_#7c2d14] hover:-translate-y-px active:translate-y-px"
          >
            Pin it to the board →
          </button>
        </form>
      </main>
    </>
  );
}

