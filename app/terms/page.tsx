import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { CONTACT_EMAIL, OPERATOR, GOVERNING_LAW, SITE_NAME, SITE_DOMAIN } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms & Conditions — Corkbored",
  description: "The terms governing your use of Corkbored.",
};

const BODY = `
These Terms & Conditions ("Terms") are a legal agreement between you and ${OPERATOR}
("we", "us", "our") governing your use of ${SITE_NAME} at ${SITE_DOMAIN} and related
services (the "Service"). By using the Service you agree to these Terms. If you do
not agree, do not use the Service.

## 1. Eligibility

You must be at least 16 years old (or the minimum age of digital consent in your
country) and able to form a binding contract to use the Service.

## 2. Your account

You sign in using GitHub. You are responsible for activity under your account and
for keeping your GitHub credentials secure. You must provide accurate information
and keep it up to date. We may suspend or terminate accounts that violate these
Terms.

## 3. Acceptable use

You agree **not** to:

- post unlawful, infringing, deceptive, harassing, hateful, or abusive content;
- spam, phish, distribute malware, or post fraudulent or scam content (including
  crypto or payment solicitations);
- misrepresent your identity, skills, or affiliation;
- scrape, overload, probe, or interfere with the Service or its security;
- use the Service to violate anyone's privacy or intellectual-property rights; or
- use the Service for any illegal purpose.

## 4. Your content

You retain ownership of the content you submit (projects, applications,
announcements, messages, and so on). You grant us a worldwide, non-exclusive,
royalty-free licence to host, store, reproduce, and display that content as needed
to operate and promote the Service. You are responsible for your content and
confirm you have the rights to post it.

We may review, moderate, remove, or restrict content (including automatically) that
we reasonably believe violates these Terms or is otherwise harmful, but we are not
obliged to monitor content.

## 5. Collaboration between users

${SITE_NAME} helps developers find projects and collaborators. **We do not vet or
endorse users, projects, or their claims, and we are not a party to any arrangement
you enter into with other users.** Any collaboration, contribution, employment, or
other relationship is solely between the users involved and at your own risk. You
are responsible for your own due diligence, agreements (including around
intellectual property and licensing), and conduct.

## 6. Paid features

Some features (such as project "boosts") may be offered for a fee. Payments are
processed by Stripe and are subject to Stripe's terms. Prices and what each feature
includes are shown at the point of purchase. Except where required by law, fees are
non-refundable. We may change or discontinue paid features at any time.

## 7. Intellectual property

The Service itself — including its software, design, branding, and content we
create — is owned by us or our licensors and protected by intellectual-property
laws. These Terms do not grant you any rights to our trademarks or branding.

## 8. Third-party services and links

The Service integrates with and links to third-party services (such as GitHub and
Stripe) and to external websites. We are not responsible for third-party services or
content, and your use of them is governed by their own terms and policies.

## 9. Disclaimers

The Service is provided **"as is" and "as available"** without warranties of any
kind, whether express or implied, including fitness for a particular purpose,
merchantability, and non-infringement. We do not warrant that the Service will be
uninterrupted, secure, or error-free, or that any content is accurate or reliable.

## 10. Limitation of liability

To the maximum extent permitted by law, we will not be liable for any indirect,
incidental, special, consequential, or punitive damages, or for any loss of
profits, data, goodwill, or opportunities, arising out of or relating to your use
of the Service. To the extent we are found liable, our total liability for all
claims relating to the Service will not exceed the greater of (a) the amount you
paid us in the 12 months before the claim, or (b) USD 100. Some jurisdictions do
not allow certain limitations, so some of these may not apply to you.

## 11. Indemnification

You agree to indemnify and hold us harmless from any claims, damages, losses, and
expenses (including reasonable legal fees) arising from your content, your use of
the Service, or your breach of these Terms or of any law or third-party rights.

## 12. Termination

You may stop using the Service and delete your account at any time. We may suspend
or terminate your access if you breach these Terms or if we discontinue the
Service. Provisions that by their nature should survive termination (including
Sections 4, 7, 9, 10, and 11) will survive.

## 13. Governing law and disputes

These Terms are governed by the laws of ${GOVERNING_LAW}, without regard to its
conflict-of-laws rules, and the courts of that jurisdiction will have exclusive
jurisdiction over any disputes, except where mandatory consumer-protection laws in
your country of residence give you the right to bring proceedings locally. *(The
governing jurisdiction should be confirmed with legal counsel before launch.)*

## 14. Changes to these Terms

We may update these Terms from time to time. Material changes will be reflected by
updating the "Last updated" date above, and your continued use of the Service after
changes take effect constitutes acceptance.

## 15. Contact

Questions about these Terms: **${CONTACT_EMAIL}**.
`;

export default function TermsPage() {
  return <LegalPage title="Terms & Conditions" body={BODY} />;
}
