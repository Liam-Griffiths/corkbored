import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Cookie Policy — Corkbored",
  description: "How Corkbored uses cookies. We only use strictly necessary cookies.",
};

const BODY = `
This policy explains how ${SITE_NAME} uses cookies and similar technologies.

## What cookies are

Cookies are small text files stored on your device when you visit a website. They
let the site remember things like whether you are signed in.

## The cookies we use

We use **only strictly necessary cookies** — the ones required to sign you in and
keep the Service secure. We do **not** use advertising, analytics, or tracking
cookies, and we do not share cookie data with advertisers.

| Cookie | Purpose | Type | Retention |
| --- | --- | --- | --- |
| Session / authentication cookie | Keeps you signed in to your account | Strictly necessary | Until expiry or sign-out |
| CSRF / security token | Protects sign-in and form submissions against forgery | Strictly necessary | Session |

Because these cookies are essential to provide a service you have requested, they
do not require opt-in consent under the UK/EU ePrivacy rules. We show a brief notice
so you are informed of their use. If we ever introduce non-essential cookies (such
as analytics), we will ask for your consent first and update this page.

## Third-party cookies

Signing in uses GitHub, and payments use Stripe; these providers may set their own
cookies on their own domains when you interact with them. Their cookie use is
governed by their respective policies.

## Managing cookies

You can block or delete cookies through your browser settings. Note that blocking
the strictly necessary cookies above will prevent you from signing in and using the
Service.

## Contact

Questions: **${CONTACT_EMAIL}**.
`;

export default function CookiesPage() {
  return <LegalPage title="Cookie Policy" body={BODY} />;
}
