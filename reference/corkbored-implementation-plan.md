# Corkbored — Implementation Plan for AI Coding Agents

**Audience:** an AI coding agent (e.g., Claude Code) executing tasks one at a time.
**Companion docs:** `corkbored-mvp-spec.md` (product spec + SQL data model), `corkbored-prototype/index.html` (UI reference), `corkbored-landing/index.html` (already done — deploy as-is).
**Goal:** ship the MVP described in the spec. Nothing more.

---

## Rules for the agent (read before every task)

1. **Do exactly one task at a time**, in order. Do not start a task until the previous task's Definition of Done (DoD) passes.
2. **Do not refactor, rename, or "improve" code outside the current task.** If you notice a problem elsewhere, write it in `NOTES.md` and move on.
3. **Do not add libraries** beyond the locked list in Section 1. If a task seems to need a new library, stop and ask the human.
4. **Do not invent features.** If the plan doesn't mention it, it doesn't exist in v1.
5. After every task, run: `npm run lint && npm run typecheck && npm run build`. All three must pass before the task is done.
6. Commit after every completed task with the message format: `feat(phase-N): <task title>`.
7. Secrets only ever go in `.env.local` (gitignored). Never hardcode a key, even a test key.
8. When a task says "HUMAN TASK", stop and tell the human what to do. Do not attempt to fake or mock it permanently.
9. UI styling: copy the design tokens from the prototype (`:root` CSS variables in `corkbored-prototype/index.html`). Do not invent a new design.
10. If anything in this plan contradicts the spec, the spec's data model wins; this plan's task ordering wins.

---

## Section 1 — Locked technical decisions

| Decision | Choice | Notes |
|---|---|---|
| Framework | Next.js 15+, App Router, TypeScript strict | one deployable |
| Styling | Tailwind CSS | map prototype CSS vars into `tailwind.config` theme |
| ORM | Prisma | schema below mirrors the spec's SQL |
| Database | PostgreSQL on Neon | free tier; `DATABASE_URL` env var |
| Auth | Auth.js (NextAuth v5) with GitHub OAuth provider | GitHub is the ONLY login method |
| GitHub integration | GitHub App (separate from OAuth app) via `octokit` | repo verification, invites, webhooks |
| Email | Resend | transactional only |
| Background work | Vercel Cron hitting route handlers | no queue library in v1 |
| LLM triage | Anthropic API, model `claude-haiku-4-5` | via `@anthropic-ai/sdk` |
| Validation | Zod on every API input | no exceptions |
| Hosting | Vercel | landing page deploys as static |
| Tests | Vitest for unit; manual checklist per phase for E2E | keep light |

**Allowed dependencies (complete list):** `next`, `react`, `react-dom`, `typescript`, `tailwindcss`, `prisma`, `@prisma/client`, `next-auth@beta`, `@auth/prisma-adapter`, `octokit`, `zod`, `resend`, `@anthropic-ai/sdk`, `vitest`, `eslint` + Next defaults. Nothing else without human approval.

**Environment variables (define all in `.env.example` with placeholder values):**

```
DATABASE_URL=
AUTH_SECRET=
AUTH_GITHUB_ID=            # OAuth app (login)
AUTH_GITHUB_SECRET=
GITHUB_APP_ID=             # GitHub App (repo operations)
GITHUB_APP_PRIVATE_KEY=
GITHUB_WEBHOOK_SECRET=
ANTHROPIC_API_KEY=
RESEND_API_KEY=
NEXT_PUBLIC_APP_URL=
ADMIN_GITHUB_LOGINS=       # comma-separated GitHub logins who get admin
```

---

## Section 2 — Repository layout (create exactly this)

```
corkbored/
  prisma/schema.prisma
  src/
    app/
      (marketing)/page.tsx          # redirect to /board for signed-in users
      board/page.tsx                # the board (browse)
      p/[slug]/page.tsx             # public project page
      p/[slug]/dashboard/page.tsx   # owner/maintainer dashboard
      me/page.tsx                   # my profile + my applications
      admin/moderation/page.tsx     # mod queue
      api/auth/[...nextauth]/route.ts
      api/projects/route.ts
      api/projects/[slug]/route.ts
      api/projects/[slug]/roles/route.ts
      api/projects/[slug]/announcements/route.ts
      api/projects/[slug]/tasks/route.ts
      api/tasks/[id]/route.ts
      api/projects/[slug]/messages/route.ts
      api/roles/[id]/applications/route.ts
      api/applications/[id]/route.ts
      api/memberships/[id]/route.ts
      api/reports/route.ts
      api/admin/moderation/[id]/route.ts
      api/webhooks/github/route.ts
      api/cron/refresh-github-stats/route.ts
    lib/
      db.ts                # Prisma client singleton
      auth.ts              # Auth.js config
      github.ts            # all octokit calls live here, nowhere else
      moderation.ts        # LLM triage, nowhere else calls Anthropic
      email.ts             # all Resend calls live here
      validators.ts        # all Zod schemas
      authz.ts             # isOwner / isMember / isAdmin helpers
    components/            # presentational components only, no data fetching
  NOTES.md
  .env.example
```

Rule: **all external I/O is confined to `src/lib/*.ts`.** Route handlers and pages never import `octokit`, `resend`, or `@anthropic-ai/sdk` directly.

---

## Section 3 — Phases and tasks

### Phase 0 — Scaffold

**Task 0.1 — Initialize project.**
Steps: `npx create-next-app@latest corkbored --typescript --tailwind --app --eslint --src-dir`. Add `typecheck` script (`tsc --noEmit`). Create `NOTES.md`, `.env.example` with all vars from Section 1. Add Vitest with one trivial passing test.
DoD: `npm run lint && npm run typecheck && npm run build && npm test` all pass on a clean clone.

**Task 0.2 — Design tokens.**
Steps: copy the `:root` variables from `corkbored-prototype/index.html` into Tailwind theme (colors: `board`, `board-deep`, `paper`, `paper-edge`, `ink`, `ink-soft`, `pin-red`, `pin-teal`, `pin-gold`; fonts: display = Bricolage Grotesque, sans = IBM Plex Sans, mono = IBM Plex Mono via `next/font`). Build a throwaway page `/styleguide` showing each color and font.
DoD: `/styleguide` renders all tokens; visual match with prototype confirmed by human.

### Phase 1 — Database

**Task 1.1 — Prisma schema.**
Translate the SQL in `corkbored-mvp-spec.md` Section 4 into `prisma/schema.prisma`, models: `User`, `UserSkill`, `GithubStats`, `Project`, `ProjectTag`, `Role`, `Application`, `Membership`, `ContributionEvent`, `Task`, `Message`, `Announcement`, `Notification`, `Report`, `ModerationItem` (maps to `moderation_queue`). Plus Auth.js adapter models (`Account`, `Session`, `VerificationToken`). Use enums for every `check (... in (...))` constraint. Preserve every `unique` constraint and index from the spec.
DoD: `npx prisma migrate dev` succeeds against a local/Neon dev database; `npx prisma studio` shows all tables; constraint check: creating two projects with the same `repoId` in studio fails.

**Task 1.2 — Seed script.**
`prisma/seed.ts` creating 3 users, 4 projects (reuse the prototype's mock data: ledgerline, trailcache, promptpit, patchbay), roles, 3 applications, announcements, 2 moderation items.
DoD: `npx prisma db seed` is idempotent (run twice, no errors, no duplicates).

### Phase 2 — Auth

**Task 2.1 — GitHub OAuth login.**
Auth.js v5 with GitHub provider + Prisma adapter. On first sign-in, populate `User.githubId`, `githubLogin`, `displayName`, `avatarUrl`, `email`. Header component with sign-in/out matching prototype top bar.
HUMAN TASK first: create a GitHub OAuth app, provide `AUTH_GITHUB_ID/SECRET`.
DoD: full sign-in/out round trip works locally; user row appears in DB with `githubId` set; `isAdmin` is true iff `githubLogin` is in `ADMIN_GITHUB_LOGINS`.

**Task 2.2 — authz helpers.**
`src/lib/authz.ts`: `requireUser()`, `requireProjectOwner(projectId)`, `requireProjectMember(projectId)`, `requireAdmin()`. Each throws a typed error the API layer maps to 401/403. Unit-test all four with Vitest against a test DB.
DoD: tests pass; an unauthenticated request to any mutating endpoint returns 401 (verify once Phase 3 endpoints exist — note in NOTES.md to re-verify).

### Phase 3 — Projects & the proof-of-work gate

**Task 3.1 — GitHub App + repo verification.**
HUMAN TASK first: create a GitHub App (permissions: repository metadata read, contents read, administration write for collaborator invites; webhook events: push, pull_request, release), provide `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`.
Then implement in `src/lib/github.ts`: `verifyRepoForUser(repoFullName, user)` → checks repo exists, user has admin or push permission, repo has ≥ 5 commits, returns `{repoId, defaultBranch, license}` or a typed failure reason (one of: `not_found`, `no_permission`, `not_enough_commits`).
DoD: Vitest tests with mocked octokit cover all 4 outcomes (success + 3 failures).

**Task 3.2 — Create/edit project API + form.**
`POST /api/projects` validates with Zod (title ≤ 80 chars, pitch ≤ 280, stage enum, 1–6 tags), runs `verifyRepoForUser`, generates unique slug, creates Project + owner Membership in one transaction. `PATCH /api/projects/[slug]` (owner only). Build the "Pin a project" form page.
DoD: posting with a repo you don't control returns 422 with the typed reason; success creates project + owner membership; duplicate repo returns 409.

**Task 3.3 — Board + project page (read).**
`/board`: server-rendered grid styled like prototype cards, filters by tag/stage via query params, Postgres full-text search on title/pitch via `q` param. `/p/[slug]`: public project page showing pitch, repo link, tags, team, open roles, announcements.
DoD: board renders seeded projects; filters and search work; project page renders for a signed-out visitor.

### Phase 4 — Roles & applications

**Task 4.1 — Roles CRUD.** `POST /api/projects/[slug]/roles` (owner), `PATCH /api/roles/[id]` for status open/filled/closed. Max 5 open roles per project (enforce in handler).
DoD: 6th open role returns 422; non-owner returns 403.

**Task 4.2 — Apply flow.** `POST /api/roles/[id]/applications`: pitch 20–500 chars, dedupe on (roleId, applicantId) → 409, owner cannot apply to own project → 422, rate limit 10/day per user (count rows created today). Apply modal on project page matching prototype.
DoD: all four error paths verified; success row visible in `/me`.

**Task 4.3 — Review flow + dashboard shell.** `/p/[slug]/dashboard` (owner/maintainer only) with tabs: Applications, Announcements, Team, Activity, Roles — copy the prototype layout. Applications tab lists pending applications with the applicant's `GithubStats` signal (account age, repos, commits/90d, top languages — fetch and cache on application creation). `PATCH /api/applications/[id]` accept/decline.
DoD: accept creates an active Membership; decline sets status; both notify the applicant (Notification row; email wired in Phase 6).

**Task 4.4 — Repo invite on accept.** In `github.ts`: `inviteCollaborator(repoFullName, githubLogin)`; call on accept; store `githubInviteStatus`. On failure, set `failed` and show the owner a manual-fallback banner ("invite them on GitHub, then mark as added").
DoD: mocked-octokit tests for success and failure; failure path renders the banner.

**Task 4.5 — Membership lifecycle.** `DELETE /api/memberships/[id]`: self-leave or owner-remove; sets `leftAt` + `removedBy`, never deletes the row; attempts invite revocation via GitHub API.
DoD: removed member's row persists with `leftAt` set; they lose dashboard access immediately.

### Phase 5 — Announcements & activity

**Task 5.1 — Announcements.** `POST /api/projects/[slug]/announcements` (owner/maintainer, 3/day per project), kinds: update/release/roles_open/milestone. Dashboard tab with post form; project page list; global "Fresh off the board" strip on `/board` (latest 10 published, link to project).
DoD: posting appears in all three places; 4th post in a day returns 429.

**Task 5.2 — GitHub webhooks → activity feed.** `POST /api/webhooks/github`: verify HMAC signature (reject 401 if invalid — test this), handle `push`, `pull_request` (merged only), `release`; upsert `ContributionEvent` rows keyed by the spec's unique constraint; match commit authors to users by GitHub login where possible. Activity tab reads from this table.
DoD: replaying the same webhook payload twice creates exactly one row; invalid signature rejected; activity tab renders events.

**Task 5.3 — Stats refresh cron.** `GET /api/cron/refresh-github-stats` (protected by Vercel cron secret header): refresh `GithubStats` for users active in last 30 days. Configure `vercel.json` cron, nightly.
DoD: manual invocation refreshes seeded users; unauthorized call returns 401.

### Phase 6 — Notifications & email

**Task 6.1 — Notifications.** Notification rows created on: application received, application decided, invite accepted, new announcement on a project you're a member of. Bell dropdown in header, mark-as-read.
DoD: each trigger produces exactly one row for the right user.

**Task 6.2 — Email.** `src/lib/email.ts` with Resend; templates (plain, text-first) for the same four events; `emailedAt` stamped; never email a user for their own action.
HUMAN TASK: Resend account + domain DNS verification for corkbored.com.
DoD: test mode logs payloads; one real email verified by human end-to-end.

### Phase 7 — Moderation (reports + LLM triage)

**Task 7.1 — Reports.** `POST /api/reports` on projects, applications, announcements (reason 10–500 chars, rate limit 10/day). Report buttons per prototype. Each report creates a `ModerationItem` with `verdict=null` flagged as user-report (goes to top of queue).
DoD: report creates both rows; reporter sees a confirmation toast.

**Task 7.2 — LLM triage.** `src/lib/moderation.ts`: `triage(subjectType, text, context)` calling `claude-haiku-4-5` with this exact system prompt:

```
You are a content triage classifier for Corkbored, a platform where software
developers post side projects and apply to collaborate. Classify the content
as exactly one of: clean, borderline, spam.

spam = promotional scams, payment/crypto solicitation, phishing links, repo
spam (forks with no original work posted as projects), mass-posted duplicate
text, or abusive/harassing content.
borderline = low-effort but plausibly sincere (e.g., a one-line application
from a new developer), off-topic but harmless, or anything you are unsure of.
clean = ordinary good-faith content.

Never classify content as spam merely because the author seems inexperienced.
Respond with ONLY a JSON object: {"verdict": "...", "confidence": 0.0-1.0,
"reasons": "<one or two short sentences>"}
```

Parse defensively (strip code fences; on parse failure or API error, store `verdict=borderline`, `confidence=0`, `reasons="triage failed — needs human review"` — **fail open to human review, never fail closed by blocking**). Wire into creation of projects, applications, announcements. Policy: `clean` → publish; `borderline` → publish + queue; `spam` → set content's `moderationStatus=held` (held projects/announcements invisible on board; held applications invisible to owner) + queue. **The system never bans automatically.**
DoD: Vitest tests with mocked Anthropic client cover all three verdicts + parse-failure path; a seeded spam-like project is held and absent from `/board`.

**Task 7.3 — Admin queue.** `/admin/moderation` (admin only): list undecided items, verdict pill + confidence + reasons per prototype; actions approve (publish/keep) and remove (sets `removed`, notifies author). Log `decidedBy/decidedAt`.
DoD: non-admin gets 403; approve on a held item makes it visible on the board.

### Phase 8 — Team workspace (kanban + discussion)

**Task 8.1 — Tasks model + API.** Prisma model `Task` per the spec (status enum todo/doing/done, `position` float for fractional ordering, optional assignee who must be an active member). `POST /api/projects/[slug]/tasks` and `PATCH /api/tasks/[id]` (members only, Zod-validated; title ≤ 120 chars). When status changes to `done` and the task has an assignee, create a `ContributionEvent` of kind `manual` in the same transaction.
DoD: non-member gets 403; assigning a non-member returns 422; moving a task to done creates exactly one contribution event (moving it back and to done again must NOT create a second — guard with the unique constraint, externalId = task id).

**Task 8.2 — Kanban UI.** New "Tasks" tab on the dashboard: three columns, native HTML5 drag-and-drop (no DnD library — it's on the banned-dependency list by omission), optimistic move with rollback on API failure, assignee avatar chip, add-task input at the top of the todo column. Reordering within a column sets `position` to the midpoint of its neighbors.
DoD: drag between columns persists across reload; two browser windows show consistent state after refresh; works with keyboard (buttons for move-left/move-right as fallback — drag-and-drop alone is not accessible).

**Task 8.3 — Discussion model + API.** Prisma model `Message` per the spec: one level of threading only (`parentId` must reference a root message, never another reply — enforce in the handler). `POST /api/projects/[slug]/messages`, members only, body 1–5000 chars markdown, rate limit 60/day per user per project. Soft delete own messages.
DoD: replying to a reply returns 422; non-member gets 403 on both read and write (discussion is private to the team).

**Task 8.4 — Discussion UI + notifications.** "Discussion" tab: thread list (roots newest-first, replies oldest-first), composer, rendered markdown (sanitized — use the same renderer as announcements). Notification row for members on new root threads only (not every reply — that's noise).
DoD: posting renders immediately; markdown XSS test (`<script>` in body) renders inert; each member except the author gets exactly one notification per new thread.

### Phase 9 — Profile, polish, deploy

**Task 9.1 — `/me`.** Profile editing (availability, hours/week, skills, looking-for), my applications with statuses, my memberships.
**Task 9.2 — Quality pass.** Empty states everywhere (copy tone: direct, no apologies), mobile at 380px, keyboard focus visible, loading states, 404/500 pages.
**Task 9.3 — Deploy.** HUMAN TASKS: Vercel project + env vars, Neon production DB, point corkbored.com (landing at `/`, app at `/board`, or app subdomain — human's choice), GitHub App webhook URL → production, register cron.
DoD: full happy path on production with a real second GitHub account: sign in → pin project → second account applies → accept → real GitHub invite arrives → announcement posts → appears in global feed → both accounts move tasks on the kanban and exchange a discussion thread.

---

## Section 4 — Manual E2E checklist (run after phases 4, 7, 8, and 9)

1. Sign out. Board and project pages load; dashboard redirects to sign-in.
2. Sign in as non-owner. Apply to a role twice → second attempt blocked.
3. Apply to own project → blocked.
4. Post project with someone else's repo → 422 `no_permission`.
5. Accept an application → membership active, invite status visible, notification + email sent.
6. Remove a member → row retains `leftAt`, dashboard access gone, including Tasks and Discussion tabs.
7. Post 4 announcements in a day → 4th blocked.
8. Submit obviously spammy project text → held, not on board, present in admin queue.
9. Admin approves held item → appears on board.
10. Drag a task to done → contribution event appears in Activity; drag it back and to done again → still only one event.
11. Non-member opens a project's Discussion via URL → 403/redirect; member posts a thread → other members notified once.
12. Lighthouse on `/board`: performance ≥ 90 desktop.

## Section 5 — Explicitly deferred (do not build)

Real-time chat (WebSockets, presence, typing — the async Discussion tab is the v1 answer), contribution agreements/e-sign, revenue accounting, reputation scores, follows/stars, GitHub Issues sync for the kanban, search beyond Postgres FTS, org accounts, payments, public API, dark/light theme toggle. If a task seems to require any of these, the task is being misread — stop and re-read.
