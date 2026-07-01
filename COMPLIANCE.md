s# Compliance & Launch Readiness Checklist

Living checklist for legal/privacy/security readiness. **None of this is legal advice** —
the documents and mechanisms below are standard templates and engineering measures;
have a qualified lawyer review the legal docs before launch, especially given the
mixed jurisdiction (operator in Canada, UK citizen, US `.com`, international users).

Legend: ✅ done in code · ⬜ to do · 👤 human/ops task (not code)

---

## Legal documents (in app)

- ✅ Terms & Conditions — `/terms` (`app/terms/page.tsx`)
- ✅ Privacy Policy — `/privacy` (`app/privacy/page.tsx`), GDPR + CCPA + PIPEDA sections
- ✅ Cookie Policy — `/cookies` (`app/cookies/page.tsx`)
- ✅ Copyright / DMCA Policy — `/dmca` (`app/dmca/page.tsx`)
- ✅ Footer + legal-nav links to all of the above
- ⬜ **Confirm placeholders in `lib/legal.ts`** before launch:
  - `OPERATOR` — registered legal name / entity (currently "Corkbored")
  - `GOVERNING_LAW` — currently "Ontario, Canada"; confirm with counsel
  - `CONTACT_EMAIL` — `privacy@corkbored.com`
- 👤 **Have a lawyer review all four documents.**
- 👤 Set up and **monitor `privacy@corkbored.com`** (and consider `dmca@`).

## Consent & age

- ✅ Sign-in consent gate — `/signin` requires a 16+ / Terms+Privacy checkbox (`SignInForm`)
- ✅ Acceptance recorded — `User.termsAcceptedAt` + `termsVersion` via `cb_consent` cookie bridge (`lib/auth.ts`)
- ✅ Policy versioning — `TERMS_VERSION` in `lib/legal.ts` (bump on material change)
- ⬜ Re-prompt existing/returning users when `TERMS_VERSION` changes (would need a
  blocking interstitial; currently only captured at sign-in)
- ⬜ Backfill: users created before the consent gate have no acceptance record

## Data subject rights (GDPR / CCPA / PIPEDA)

- ✅ Right of access / portability — background data export (`/me` → request → download
  JSON). Routes: `POST/GET /api/account/export`, `GET /api/account/export/[id]`; builder
  `buildDataExport` in `lib/account.ts`; cron fallback `/api/cron/process-data-exports`
- ✅ Right to erasure — self-serve hard delete (`/me` → Delete account →
  `DELETE /api/account` → `deleteUserAccount`, atomic transaction)
- ✅ Right to rectification — profile editing on `/me`
- ⬜ **Test account deletion against a database copy** — it is a true hard delete with
  ordered FK cleanup; atomic so it fails safe, but not yet verified on real data
- ⬜ OAuth tokens are intentionally excluded from the export (security); document this
  stance if a regulator asks
- 👤 Process for manual rights requests that arrive by email (respond within 30 days)

## Cookies & tracking

- ✅ Strictly-necessary cookies only (auth/session) — documented in Cookie Policy
- ✅ Informational cookie notice banner (`CookieNotice`)
- ⬜ **If analytics/marketing cookies are ever added**, replace the notice with a real
  consent flow (reject + granular options) before they load

## Security

- ✅ Security headers — CSP, HSTS, X-Frame-Options, X-Content-Type-Options,
  Referrer-Policy, Permissions-Policy (`next.config.ts`)
- ✅ Stripe webhook signature verification (`stripe.webhooks.constructEvent`)
- ✅ GitHub webhook HMAC verification (pre-existing)
- ✅ Input validation via Zod on API routes
- ✅ Rate limits — applications (10/day), announcements (3/day), invites (20/day)
- ⬜ CSP uses `'unsafe-inline'` for scripts/styles; tighten to a nonce-based policy if desired
- ⬜ Verify CSP doesn't break anything in a production build (chat WebSocket, assets)
- 👤 Rotate and scope secrets; confirm none committed; least-privilege `GITHUB_TOKEN`
- 👤 Document a data-breach response plan (72-hour GDPR notification readiness)

## Email

- ✅ Provider behind `EMAIL_ENABLED`; notification fan-out behind `NOTIFICATION_EMAILS_ENABLED`
- ✅ Transactional vs notification categorization (invites/export = transactional)
- 👤 **Verify `corkbored.com` domain DNS in Resend** (SPF/DKIM/DMARC) before `EMAIL_ENABLED=true`

## Third-party processors (disclosed in Privacy Policy)

GitHub · Vercel · Neon · Resend · Anthropic (content moderation) · Stripe

- 👤 **Sign a Data Processing Agreement (DPA) with each** processor
- 👤 Confirm international-transfer safeguards (SCCs) are in place with each
- 👤 Confirm Anthropic data-handling terms (user content is sent for moderation)

## Records & registration (ops)

- 👤 Record of Processing Activities (ROPA) — GDPR Art. 30 internal document
- 👤 Check whether an ICO registration/fee is owed (UK tie)
- 👤 Documented backup & retention schedule
- 👤 Keep dated history of policy versions

---

_Last reviewed: 2026-06-23_
