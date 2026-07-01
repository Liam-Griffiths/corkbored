// Single source of truth for the legal pages. Update LAST_UPDATED whenever the
// substance of Terms / Privacy / Cookie policy changes.
//
// PLACEHOLDERS TO CONFIRM BEFORE LAUNCH (have a lawyer review):
//   OPERATOR        — the legal entity or person acting as data controller.
//   GOVERNING_LAW   — which courts/law govern the Terms (see note in terms page).
// The operator is currently an individual based in Canada (UK citizen) running a
// .com service used internationally, so the docs grant GDPR-level rights to all
// users and add CCPA (California) and PIPEDA (Canada) notes.

export const CONTACT_EMAIL = "privacy@corkbored.com";
export const OPERATOR = "Corkbored"; // TODO: replace with registered legal name / entity
export const GOVERNING_LAW = "the Province of Ontario, Canada"; // TODO: confirm with counsel
export const LAST_UPDATED = "22 June 2026";
// Bump when the Terms or Privacy Policy change materially. Stored against each
// user's acceptance so you can prove which version they agreed to.
export const TERMS_VERSION = "2026-06-22";
// httpOnly cookie that carries pre-auth consent across the GitHub OAuth round trip.
export const CONSENT_COOKIE = "cb_consent";
export const SITE_NAME = "Corkbored";
export const SITE_DOMAIN = "corkbored.com";
