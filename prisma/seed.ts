import "dotenv/config";
import { prisma } from "../lib/db";

// Nested ProjectTag create that upserts the canonical Tag by slug.
function tagLink(label: string) {
  const slug = label.trim().toLowerCase().replace(/[^a-z0-9.+#-]/g, "");
  return { tag: { connectOrCreate: { where: { slug }, create: { slug, label } } } };
}

async function main() {
  // ── Users ──────────────────────────────────────────────────────────────────
  const mira = await prisma.user.upsert({
    where: { githubLogin: "mira" },
    update: {},
    create: {
      githubId: 1001,
      githubLogin: "mira",
      displayName: "Mira",
      name: "Mira",
      email: "mira@example.dev",
      avatarUrl: "https://avatars.githubusercontent.com/u/1001",
    },
  });

  const sara = await prisma.user.upsert({
    where: { githubLogin: "dev-sara" },
    update: {},
    create: {
      githubId: 1002,
      githubLogin: "dev-sara",
      displayName: "Sara",
      name: "Sara",
      email: "sara@example.dev",
      avatarUrl: "https://avatars.githubusercontent.com/u/1002",
    },
  });

  const jq = await prisma.user.upsert({
    where: { githubLogin: "jq-dev" },
    update: {},
    create: {
      githubId: 1003,
      githubLogin: "jq-dev",
      displayName: "JQ",
      name: "JQ",
      email: "jq@example.dev",
      avatarUrl: "https://avatars.githubusercontent.com/u/1003",
      isAdmin: true,
    },
  });

  const noah = await prisma.user.upsert({
    where: { githubLogin: "noiseboy" },
    update: {},
    create: {
      githubId: 1004,
      githubLogin: "noiseboy",
      displayName: "Noah",
      name: "Noah",
      email: "noah@example.dev",
      avatarUrl: "https://avatars.githubusercontent.com/u/1004",
    },
  });

  const ana = await prisma.user.upsert({
    where: { githubLogin: "ana-builds" },
    update: {},
    create: {
      githubId: 1005,
      githubLogin: "ana-builds",
      displayName: "Ana",
      name: "Ana",
      email: "ana@example.dev",
      avatarUrl: "https://avatars.githubusercontent.com/u/1005",
    },
  });

  // ── Projects ───────────────────────────────────────────────────────────────
  const ledgerline = await prisma.project.upsert({
    where: { slug: "ledgerline" },
    update: {},
    create: {
      slug: "ledgerline",
      title: "Open-source budgeting for freelancers",
      pitch:
        "Plain-text-friendly budgeting that imports bank CSVs, tracks irregular freelance income, and forecasts dry months. 1.2k stars, real users, needs mobile.",
      repoId: "mira/ledgerline",
      repoFullName: "mira/ledgerline",
      stage: "launched",
      ownerId: mira.id,
      tags: { create: [tagLink("TypeScript"), tagLink("Postgres")] },
    },
  });

  const trailcache = await prisma.project.upsert({
    where: { slug: "trailcache" },
    update: {},
    create: {
      slug: "trailcache",
      title: "Offline maps for backcountry hikers",
      pitch:
        "Vector tiles compiled to a single offline bundle. Works with zero bars on a ridgeline. Backend is Rust; client is React Native.",
      repoId: "dev-sara/trailcache",
      repoFullName: "dev-sara/trailcache",
      stage: "building",
      ownerId: sara.id,
      tags: { create: [tagLink("Rust"), tagLink("React Native")] },
    },
  });

  const promptpit = await prisma.project.upsert({
    where: { slug: "promptpit" },
    update: {},
    create: {
      slug: "promptpit",
      title: "Self-hosted eval harness for LLM apps",
      pitch:
        "Run regression evals on your prompts locally. Diff model outputs across versions, score with rubrics, no cloud required.",
      repoId: "jq-dev/promptpit",
      repoFullName: "jq-dev/promptpit",
      stage: "prototype",
      ownerId: jq.id,
      tags: { create: [tagLink("Python"), tagLink("SQLite")] },
    },
  });

  const patchbay = await prisma.project.upsert({
    where: { slug: "patchbay" },
    update: {},
    create: {
      slug: "patchbay",
      title: "Browser-based modular synth",
      pitch:
        "Drag-and-drop oscillators, filters, and sequencers in the browser. Shareable patches via URL.",
      repoId: "noiseboy/patchbay",
      repoFullName: "noiseboy/patchbay",
      stage: "building",
      ownerId: noah.id,
      tags: { create: [tagLink("TypeScript"), tagLink("WebAudio")] },
    },
  });

  // ── Owner memberships ──────────────────────────────────────────────────────
  const membershipPairs = [
    { projectId: ledgerline.id, userId: mira.id },
    { projectId: trailcache.id, userId: sara.id },
    { projectId: promptpit.id, userId: jq.id },
    { projectId: patchbay.id, userId: noah.id },
    // Ana is a member of promptpit
    { projectId: promptpit.id, userId: ana.id },
  ];

  for (const { projectId, userId } of membershipPairs) {
    await prisma.membership.upsert({
      where: { projectId_userId: { projectId, userId } },
      update: {},
      create: {
        projectId,
        userId,
        role: userId === ana.id ? "member" : "owner",
      },
    });
  }

  // ── Roles ──────────────────────────────────────────────────────────────────
  const roleMobile = await prisma.role.upsert({
    where: { id: "seed-role-1" },
    update: {},
    create: {
      id: "seed-role-1",
      projectId: ledgerline.id,
      title: "Mobile dev (React Native)",
      detail: "~5 hrs/wk · own the iOS/Android client",
    },
  });

  const roleRust = await prisma.role.upsert({
    where: { id: "seed-role-2" },
    update: {},
    create: {
      id: "seed-role-2",
      projectId: trailcache.id,
      title: "Rust dev (backend)",
      detail: "tile pipeline + sync protocol",
    },
  });

  await prisma.role.upsert({
    where: { id: "seed-role-3" },
    update: {},
    create: {
      id: "seed-role-3",
      projectId: trailcache.id,
      title: "Design engineer",
      detail: "map UI, ~4 hrs/wk",
    },
  });

  const roleFrontend = await prisma.role.upsert({
    where: { id: "seed-role-4" },
    update: {},
    create: {
      id: "seed-role-4",
      projectId: promptpit.id,
      title: "Frontend dev",
      detail: "results dashboard UI",
    },
  });

  await prisma.role.upsert({
    where: { id: "seed-role-5" },
    update: {},
    create: {
      id: "seed-role-5",
      projectId: promptpit.id,
      title: "Design engineer",
      detail: "make it not look like a science project",
    },
  });

  await prisma.role.upsert({
    where: { id: "seed-role-6" },
    update: {},
    create: {
      id: "seed-role-6",
      projectId: patchbay.id,
      title: "DSP nerd",
      detail: "filters + effects chain",
    },
  });

  // ── Applications ───────────────────────────────────────────────────────────
  const priya = await prisma.user.upsert({
    where: { githubLogin: "priya-codes" },
    update: {},
    create: {
      githubId: 2001,
      githubLogin: "priya-codes",
      displayName: "Priya N.",
      name: "Priya N.",
      email: "priya@example.dev",
    },
  });

  const marcus = await prisma.user.upsert({
    where: { githubLogin: "mlux" },
    update: {},
    create: {
      githubId: 2002,
      githubLogin: "mlux",
      displayName: "Marcus L.",
      name: "Marcus L.",
      email: "marcus@example.dev",
    },
  });

  const devt = await prisma.user.upsert({
    where: { githubLogin: "devt-2026" },
    update: {},
    create: {
      githubId: 2003,
      githubLogin: "devt-2026",
      displayName: "Dev T.",
      name: "Dev T.",
      email: "devt@example.dev",
    },
  });

  await prisma.application.upsert({
    where: { roleId_applicantId: { roleId: roleFrontend.id, applicantId: priya.id } },
    update: {},
    create: {
      roleId: roleFrontend.id,
      applicantId: priya.id,
      pitch:
        "I built the results UI for an internal eval tool at my last job — happy to share screenshots. I can commit ~6 hrs/wk and want to ship something real while job hunting.",
      githubStatsCache: {
        accountAgeYears: 6,
        publicRepos: 34,
        commitsLast90d: 212,
        topLanguages: "TS 58% · Py 30%",
      },
    },
  });

  await prisma.application.upsert({
    where: { roleId_applicantId: { roleId: roleFrontend.id, applicantId: marcus.id } },
    update: {},
    create: {
      roleId: roleFrontend.id,
      applicantId: marcus.id,
      pitch:
        "Design engineer, ex-startup. Your screenshots hurt me in a way I would like to fix. Portfolio in my pinned repos.",
      githubStatsCache: {
        accountAgeYears: 4,
        publicRepos: 19,
        commitsLast90d: 98,
        topLanguages: "TS 71% · CSS 22%",
      },
    },
  });

  const lowEffortApp = await prisma.application.upsert({
    where: { roleId_applicantId: { roleId: roleFrontend.id, applicantId: devt.id } },
    update: {},
    create: {
      roleId: roleFrontend.id,
      applicantId: devt.id,
      pitch: "i can do it",
      githubStatsCache: {
        accountAgeYears: 0.06,
        publicRepos: 1,
        commitsLast90d: 2,
        topLanguages: "—",
      },
    },
  });

  // ── Announcements ──────────────────────────────────────────────────────────
  const ann1 = await prisma.announcement.upsert({
    where: { id: "seed-ann-1" },
    update: {},
    create: {
      id: "seed-ann-1",
      projectId: promptpit.id,
      authorId: jq.id,
      title: "v0.3.0 is out",
      body: "First public prototype. Diff view, rubric scoring, SQLite storage. Frontend is held together with tape — hence the open roles.",
      kind: "release",
      publishedAt: new Date(Date.now() - 86400000),
    },
  });

  const ann2 = await prisma.announcement.upsert({
    where: { id: "seed-ann-2" },
    update: {},
    create: {
      id: "seed-ann-2",
      projectId: ledgerline.id,
      authorId: mira.id,
      title: "Mobile role just opened",
      body: "Web app is stable, 1.2k stars. Time for a real mobile client — looking for one React Native dev who wants ownership of it.",
      kind: "roles_open",
      publishedAt: new Date(Date.now() - 172800000),
    },
  });

  await prisma.announcement.upsert({
    where: { id: "seed-ann-3" },
    update: {},
    create: {
      id: "seed-ann-3",
      projectId: trailcache.id,
      authorId: sara.id,
      title: "Offline bundles under 40MB",
      body: "Whole national park now fits in a single offline bundle. Sync protocol next.",
      kind: "milestone",
      publishedAt: new Date(Date.now() - 345600000),
    },
  });

  // ── Moderation queue ───────────────────────────────────────────────────────
  await prisma.moderationItem.upsert({
    where: { id: "seed-mod-1" },
    update: {},
    create: {
      id: "seed-mod-1",
      subjectType: "application",
      subjectId: lowEffortApp.id,
      applicationId: lowEffortApp.id,
      verdict: "borderline",
      confidence: 0.71,
      reasons:
        "Very low-effort pitch ('i can do it'), 3-week-old account, 2 commits in 90 days. Not abusive — likely a new dev, not a bot.",
    },
  });

  await prisma.moderationItem.upsert({
    where: { id: "seed-mod-2" },
    update: {},
    create: {
      id: "seed-mod-2",
      subjectType: "announcement",
      subjectId: ann1.id,
      announcementId: ann1.id,
      verdict: "clean",
      confidence: 0.99,
      reasons: "Routine devlog post from an active project. Published instantly.",
      decidedAt: new Date(),
    },
  });

  // ── Tasks for promptpit ────────────────────────────────────────────────────
  const taskData = [
    { id: "seed-task-1", title: "Results dashboard wireframe", status: "todo" as const, position: 1.0, assigneeId: null },
    { id: "seed-task-2", title: "Rubric scoring edge cases", status: "todo" as const, position: 2.0, assigneeId: jq.id },
    { id: "seed-task-3", title: "CSV export for eval runs", status: "doing" as const, position: 1.0, assigneeId: ana.id },
    { id: "seed-task-4", title: "SQLite migration", status: "done" as const, position: 1.0, assigneeId: jq.id },
    { id: "seed-task-5", title: "Diff view rendering fix", status: "done" as const, position: 2.0, assigneeId: jq.id },
  ];

  for (const task of taskData) {
    await prisma.task.upsert({
      where: { id: task.id },
      update: {},
      create: { ...task, projectId: promptpit.id },
    });
  }

  console.log("✓ Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
