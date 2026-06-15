# Corkbored — MVP Specification & Data Model

**Version:** 0.1 (draft)
**Domain:** corkbored.com
**One-liner:** A board where developers pin real side projects and recruit collaborators by application, not by drive-by PR.

---

## 1. Product thesis

Three problems, one platform:

1. **Lonely side projects die.** Thousands of capable developers (many currently between jobs) are building alone. Solo motivation runs out; teams keep each other shipping.
2. **Open source's open door is being abused.** Anyone can spam a repo with low-quality or AI-generated PRs. Corkbored inverts this: contributors *apply* for write access, and owners curate their team. Collaboration becomes opt-in for the maintainer.
3. **Contribution should be rewarded if a project takes off.** The platform logs who joined, when, and what they shipped — and (in v2) provides a standard revenue-sharing agreement template projects can adopt.

**Core rule: no ideas guys.** A project cannot be posted without a linked GitHub repository containing real commits. Proof of work is the entry ticket.

## 2. MVP scope

### In scope (v1)

- GitHub OAuth login (the only auth method)
- Developer profiles, auto-seeded from GitHub (avatar, bio, top languages, pinned repos), plus platform-specific fields: availability, skills, what they're looking for
- Project posting, gated by repo verification (repo must exist, be accessible, and have ≥ N commits from the poster)
- Open roles on a project ("Looking for: React dev, ~5 hrs/week")
- Applications to roles, with a short pitch; the applicant's GitHub history travels with the application
- Owner review: accept / decline. Accept triggers a GitHub repo collaborator invite via the GitHub API and creates a platform membership
- Project workspace page: members list, roles, activity feed (commits synced via webhook), pinned links (Discord, Figma, etc.)
- Team kanban: lightweight task board per project (todo / doing / done, drag-and-drop, assignees) — deliberately simpler than GitHub Projects; Issues sync is v2
- Team discussion: async threaded messages per project (members only) — decisions and context live here, tied to the membership record; real-time chat stays on Discord via the project's pinned link
- Browse & search: filter projects by language, skills needed, commitment level, project stage
- Project announcements board (per-project devlog) + global "fresh off the board" feed
- Basic notifications (in-app + email): application received, application decided, invite accepted, new announcement from your projects
- Reporting/flagging on all content, LLM triage queue (auto-hold spam, flag borderline), and an admin moderation view

### Explicitly out of scope (v1)

- The binding revenue-share agreement (v2 — ship a template + acknowledgment flow once a lawyer has reviewed it)
- Contribution weighting / equity calculation
- Real-time chat (WebSockets, presence, typing indicators) — async discussion threads are in scope; live chat is Discord's job (link out); building chat is a tarpit
- Payments of any kind
- Org/team accounts

## 3. User flows

**Post a project.** Sign in with GitHub → "Pin a project" → pick one of your repos (or paste a URL you have admin rights to) → platform verifies via GitHub API (repo exists, you have push access, ≥ 5 commits) → fill in title, pitch, stage (prototype / building / launched), tags → define 1–5 open roles → publish.

**Find a team.** Browse the board → filter by language/skill/commitment → open a project → read pitch, see the actual repo and commit activity inline → apply to a role with a ~500-char pitch → wait.

**Review applicants.** Owner gets notified → sees applicant's profile with real GitHub signal (account age, recent activity, languages, top repos) → accept or decline with optional message → on accept, platform sends a GitHub collaborator invite and adds them to the project workspace.

**Membership lifecycle.** Members can leave; owners can remove members (which also revokes the GitHub invite/access via API where possible). All joins/leaves are timestamped — this log is the foundation for v2 contribution accounting.

## 4. Data model

PostgreSQL. All tables get `id uuid primary key default gen_random_uuid()`, `created_at timestamptz default now()`, `updated_at timestamptz`. Soft-delete via `deleted_at` on user-generated content.

```sql
-- ============ Identity ============

create table users (
  id              uuid primary key default gen_random_uuid(),
  github_id       bigint unique not null,
  github_login    text not null,
  display_name    text,
  avatar_url      text,
  bio             text,
  location        text,
  availability    text check (availability in
                    ('actively_looking','open','not_looking')) default 'open',
  hours_per_week  smallint,              -- self-reported capacity
  looking_for     text,                  -- freeform "what I want to build"
  email           text,                  -- from GitHub, for notifications
  email_verified  boolean default false,
  is_admin        boolean default false,
  suspended_at    timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz
);

create table user_skills (
  user_id   uuid references users(id) on delete cascade,
  skill     text not null,               -- normalized lowercase tag
  primary key (user_id, skill)
);

-- Cached GitHub signal, refreshed periodically (don't hit the API per page view)
create table github_stats (
  user_id            uuid primary key references users(id) on delete cascade,
  public_repos       int,
  followers          int,
  account_created_at timestamptz,
  top_languages      jsonb,              -- {"TypeScript": 0.6, "Go": 0.3, ...}
  contributions_90d  int,
  refreshed_at       timestamptz
);

-- ============ Projects ============

create table projects (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references users(id),
  slug            text unique not null,
  title           text not null,
  pitch           text not null,          -- the corkboard card text
  description     text,                   -- long-form, markdown
  stage           text check (stage in
                    ('prototype','building','launched')) not null,
  repo_full_name  text not null,          -- "owner/repo"
  repo_id         bigint not null,        -- GitHub's immutable repo id
  repo_verified_at timestamptz,           -- passed the proof-of-work check
  default_branch  text,
  license         text,
  status          text check (status in
                    ('active','paused','archived','removed')) default 'active',
  links           jsonb default '[]',     -- [{label, url}] discord, figma, demo
  deleted_at      timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz,
  unique (repo_id)                        -- one corkboard card per repo
);

create table project_tags (
  project_id uuid references projects(id) on delete cascade,
  tag        text not null,
  primary key (project_id, tag)
);

create table roles (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  title         text not null,            -- "Mobile dev (React Native)"
  description   text,
  skills        text[] default '{}',
  hours_per_week smallint,                -- expected commitment
  status        text check (status in ('open','filled','closed'))
                  default 'open',
  created_at    timestamptz default now()
);

-- ============ Applications & membership ============

create table applications (
  id           uuid primary key default gen_random_uuid(),
  role_id      uuid not null references roles(id) on delete cascade,
  project_id   uuid not null references projects(id) on delete cascade,
  applicant_id uuid not null references users(id),
  pitch        text not null,             -- max ~500 chars, enforced in app
  status       text check (status in
                 ('pending','accepted','declined','withdrawn'))
                 default 'pending',
  decided_by   uuid references users(id),
  decided_at   timestamptz,
  decision_note text,
  created_at   timestamptz default now(),
  unique (role_id, applicant_id)          -- one application per role
);

create table memberships (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  user_id     uuid not null references users(id),
  role_id     uuid references roles(id),
  member_role text check (member_role in ('owner','maintainer','member'))
                default 'member',
  joined_at   timestamptz default now(),
  left_at     timestamptz,                -- null = active
  removed_by  uuid references users(id),  -- null if they left voluntarily
  github_invite_status text check (github_invite_status in
                ('pending','accepted','failed','revoked')),
  unique (project_id, user_id, joined_at) -- allows rejoin history
);

-- ============ Contribution log (foundation for v2 rev-share) ============

create table contribution_events (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  user_id     uuid references users(id),  -- null if commit author unmatched
  kind        text check (kind in
                ('commit','pr_merged','release','manual')) not null,
  external_id text,                       -- commit SHA / PR number
  summary     text,
  occurred_at timestamptz not null,
  payload     jsonb,                      -- raw webhook subset for audit
  unique (project_id, kind, external_id)
);

-- ============ Team workspace: kanban + discussion ============

create table tasks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  title       text not null,
  detail      text,
  status      text check (status in ('todo','doing','done')) default 'todo',
  position    real not null default 0,    -- fractional ordering within column
  assignee_id uuid references users(id),
  created_by  uuid not null references users(id),
  done_at     timestamptz,                 -- set when status -> done
  deleted_at  timestamptz,
  created_at  timestamptz default now(),
  updated_at  timestamptz
);
create index on tasks (project_id, status, position);

create table messages (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  author_id   uuid not null references users(id),
  parent_id   uuid references messages(id), -- null = thread root, one level deep
  body        text not null,                -- markdown, members only
  deleted_at  timestamptz,
  created_at  timestamptz default now()
);
create index on messages (project_id, parent_id, created_at);

-- ============ Announcements ============

create table announcements (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  author_id   uuid not null references users(id),
  title       text not null,
  body        text not null,              -- markdown
  kind        text check (kind in
                ('update','release','roles_open','milestone')) default 'update',
  pinned      boolean default false,
  moderation_status text check (moderation_status in
                ('published','held','removed')) default 'published',
  deleted_at  timestamptz,
  created_at  timestamptz default now()
);
create index on announcements (project_id, created_at desc);
create index on announcements (created_at desc)
  where moderation_status = 'published'; -- global feed

-- ============ Notifications & moderation ============

create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  kind       text not null,               -- 'application_received', etc.
  payload    jsonb not null,
  read_at    timestamptz,
  emailed_at timestamptz,
  created_at timestamptz default now()
);

create table reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references users(id),
  subject_type text check (subject_type in
                ('user','project','application','announcement')),
  subject_id  uuid not null,
  reason      text not null,
  status      text check (status in ('open','actioned','dismissed'))
                default 'open',
  resolved_by uuid references users(id),
  created_at  timestamptz default now()
);

-- LLM triage queue: every new piece of user content passes through here
create table moderation_queue (
  id            uuid primary key default gen_random_uuid(),
  subject_type  text not null,            -- 'project','application','announcement','report'
  subject_id    uuid not null,
  verdict       text check (verdict in
                  ('clean','borderline','spam')) ,
  confidence    real,                     -- 0..1 from the classifier
  model_reasons text,                     -- short explanation, shown to admin
  model_used    text,                     -- e.g. 'claude-haiku-4-5'
  human_decision text check (human_decision in
                  ('approved','removed','banned_user')),
  decided_by    uuid references users(id),
  decided_at    timestamptz,
  created_at    timestamptz default now()
);
create index on moderation_queue (verdict, decided_at)
  where human_decision is null;           -- the admin's open queue

-- ============ Key indexes ============

create index on projects (status, created_at desc);
create index on roles (status, project_id);
create index on applications (project_id, status);
create index on applications (applicant_id, status);
create index on memberships (user_id) where left_at is null;
create index on contribution_events (project_id, occurred_at desc);
create index on notifications (user_id, read_at);
-- Search: start with Postgres full-text on projects(title, pitch, description)
create index projects_fts on projects
  using gin (to_tsvector('english', title || ' ' || pitch || ' '
             || coalesce(description, '')));
```

Design notes: `unique (repo_id)` stops the same repo being posted twice and anchors identity to GitHub's immutable id rather than the renamable `owner/repo` string. `memberships` keeps join/leave history rather than deleting rows — when v2's revenue-share accounting arrives, "who was on this project from when to when" is already answered. `contribution_events` is append-only and deliberately dumb in v1 (just sync commits/merged PRs via webhook); the *valuation* of contributions is a v2 problem and a human one, but you can't value what you didn't record. Completed tasks are part of that record too: when a task moves to `done` with an assignee, emit a `contribution_events` row of kind `manual` — non-code work (design, docs, ops) counts, and the kanban is how it gets counted. Messages and tasks are member-only content, so they skip LLM triage at creation and rely on member reporting; the application gate already vetted everyone in the room.

## 5. GitHub integration

Build this as a **GitHub App** (not plain OAuth scopes) — finer-grained permissions, higher rate limits, and users trust it more.

- **Auth:** GitHub OAuth for login (read profile + email).
- **Repo verification:** on project posting, check the poster has admin/push permission and the repo meets the proof-of-work bar (≥ 5 commits, non-empty). Store `repo_id`.
- **Collaborator invites:** on accepted application, `PUT /repos/{owner}/{repo}/collaborators/{username}`. Track invite status; surface failures to the owner with a manual fallback ("invite them yourself, then mark as added").
- **Webhooks:** subscribe to `push`, `pull_request` (merged), `release` → write `contribution_events`, update activity feed.
- **Periodic refresh:** nightly job refreshes `github_stats` for users active in the last 30 days.

Degrade gracefully: if the GitHub App isn't installed on a repo, the project still works — you just lose the activity feed and auto-invites.

## 6. API surface (v1)

A monolith with server-rendered pages covers most of this; the JSON API exists for the interactive bits.

```
POST   /api/auth/github/callback
GET    /api/projects?tag=&language=&stage=&q=&page=
POST   /api/projects                      (runs repo verification)
GET    /api/projects/:slug
PATCH  /api/projects/:slug
POST   /api/projects/:slug/roles
PATCH  /api/roles/:id
POST   /api/roles/:id/applications
PATCH  /api/applications/:id              (accept/decline/withdraw)
GET    /api/me/applications
GET    /api/me/notifications
DELETE /api/memberships/:id               (leave / remove)
POST   /api/projects/:slug/announcements
GET    /api/announcements?feed=global|following
POST   /api/projects/:slug/tasks
PATCH  /api/tasks/:id                     (status/position/assignee)
POST   /api/projects/:slug/messages      (members only)
POST   /api/reports
GET    /api/admin/moderation-queue        (admin only)
PATCH  /api/admin/moderation-queue/:id    (approve/remove/ban)
POST   /api/webhooks/github               (HMAC-verified)
```

Rate limits: 5 project posts/day, 10 applications/day per user. Cheap insurance against the exact spam culture you're trying to escape.

## 7. Stack & infrastructure

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router) or SvelteKit | SSR for SEO on project pages; one deployable |
| DB | Postgres on Neon (or Supabase) | Free tier, branching for dev, scales later |
| Hosting | Vercel free tier or a $6/mo VPS (Hetzner/Fly) | Either is fine; VPS if you want cron + webhooks with zero platform quirks |
| Background jobs | pg-boss (Postgres-backed queue) or plain cron | No Redis needed at this scale |
| Email | Resend or Postmark | Transactional only; free tier covers thousands/mo |
| Search | Postgres full-text | Don't add Elasticsearch until FTS hurts |
| Analytics | Plausible or PostHog free tier | Privacy-friendly, devs notice |

Expected cost at launch: **$0–10/month** plus the domain. First real cost is email volume if it takes off.

## 8. Trust, safety, and the spam problem

The application gate solves PR spam structurally, but the platform itself can be spammed, so the defenses stack in layers:

**Structural:** proof-of-work gate on posting (real repo, real commits), rate limits (5 projects/day, 10 applications/day, 3 announcements/day per project), one application per role per user, GitHub account age/activity shown prominently on every application — a 2-week-old empty account is self-disqualifying without any scoring system.

**LLM triage (the moderator that scales with you):** every new piece of user-generated content — project pitches, applications, announcements — passes through a cheap classifier (Haiku-class model, a fraction of a cent per item) before or immediately after publishing. Three verdicts: `clean` publishes instantly, `spam` is auto-held pending review, `borderline` publishes but lands in the admin queue with the model's reasoning attached. Two hard rules: the model never auto-bans (a human makes every final negative call — false positives against devs who are job hunting would destroy trust), and every model verdict is logged in `moderation_queue` so you can audit its accuracy and tune the prompt. Reports filed by users skip straight to the top of the same queue. At launch scale this costs pennies a day and replaces hours of manual review.

**Human:** report buttons on every project, application, and announcement → admin review queue ordered by LLM-flagged severity. Defer reputation scores; transparency of raw GitHub signal beats a gameable number in v1.

## 8b. Announcements

Each project gets an announcements board — a lightweight devlog. Owners and maintainers post updates (`update`, `release`, `roles_open`, `milestone`); members and followers get notified. Announcements aggregate into a global "fresh off the board" feed, which doubles as a liveness signal: applicants can see at a glance whether a project is actively shipping or quietly dead. Announcements pass through the same LLM triage as everything else.

## 9. v2 roadmap (post-validation)

1. **Contribution agreement template** — lawyer-drafted, jurisdiction-aware, modeled on dynamic-equity approaches (see *Slicing Pie*). Projects toggle it on; members must e-acknowledge before joining. The platform is the template provider and record-keeper, **not** the enforcer.
2. **Contribution accounting** — turn `contribution_events` + membership history into a transparent ledger each project can use when splitting anything.
3. **Reputation** — completed-project history, peer endorsements from past teammates.
4. **Matchmaking** — "projects that need your skills" digest email; this is the retention engine.
5. **Showcase/launch board** — projects that shipped get a spotlight; success stories are your best marketing.

## 10. Success metrics for the MVP

The single number that matters: **accepted applications per week** (teams actually forming). Supporting: projects posted with ≥1 open role, application → acceptance rate (too low = browse quality problem; too high = no selectivity), and 4-week member retention on projects (are teams still committing?). If 90 days in people are forming teams and still pushing code together, build v2.
