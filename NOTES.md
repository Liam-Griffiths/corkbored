# Agent notes

## Structure notes
- Plan calls for `src/app/` and `src/lib/` but the project was bootstrapped without `--src-dir`.
  Using `app/`, `lib/`, `components/` at the project root instead. `@/*` alias maps to `./*`.
- `/styleguide` is a throwaway page added for Task 0.2 token verification; delete before production.
- `app/page.tsx` is the landing page. Set `LAUNCH_MODE=true` in Vercel env vars to switch from waitlist to live sign-in CTAs.

## TODO / noticed issues

- `/styleguide` page is still live — delete before shipping.

---

## HUMAN TASKS before launch (Task 9.3)

### 1. Deploy to Vercel
- Create a Vercel project connected to this repo.
- Add every variable from `.env.example` as a production environment variable.
- Set `CRON_SECRET` to a random secret — Vercel will use it to call `/api/cron/refresh-github-stats` nightly (schedule is already in `vercel.json`).

### 2. GitHub App (repo operations + webhooks)
- Create a GitHub App with permissions: repository metadata (read), contents (read), administration (write for collaborator invites).
- Subscribe to webhook events: `push`, `pull_request`, `release`.
- Set the webhook URL to `https://<your-domain>/api/webhooks/github`.
- Generate a private key; set `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET` in Vercel env vars.
- Once configured, implement `verifyRepoForUser` and `inviteCollaborator` in `lib/github.ts` (both are stubs returning `ok: false` until then).

### 3. Resend — transactional email
- Create a Resend account and verify the `corkbored.com` domain via DNS.
- Set `RESEND_API_KEY` in Vercel env vars.
- Remove `RESEND_TEST_MODE=true` (or leave unset) once DNS propagates — `lib/email.ts` will switch from logging to sending automatically.

### 4. Neon production database
- Provision a Neon production project and set `DATABASE_URL` in Vercel.
- Run `npx prisma migrate deploy` to apply all migrations.
- Run `npx prisma db seed` if you want the seed data in production (optional).

### 5. End-to-end smoke test (happy path)
1. Sign in with your GitHub account → check `/me` profile.
2. Pin a project (create via DB or seed for now — create-project form is Phase 3.2, pending GitHub App).
3. Sign in with a second GitHub account → browse `/board` → apply to a role.
4. Accept the application from the dashboard → confirm membership appears under `/me`.
5. Post an announcement → verify it appears in the global "Fresh off the board" strip.
6. Move a task to Done (with assignee) → check Activity tab shows a contribution event.
7. Exchange a message in Discussion → verify the other member gets a notification bell badge.
