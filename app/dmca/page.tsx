import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { CONTACT_EMAIL, OPERATOR, SITE_NAME } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Copyright / DMCA Policy — Corkbored",
  description: "How to report copyright infringement on Corkbored and our takedown process.",
};

const BODY = `
${SITE_NAME} respects intellectual-property rights and responds to clear notices of
alleged copyright infringement under the U.S. Digital Millennium Copyright Act
(DMCA) and equivalent laws.

## Reporting infringement

If you believe content on ${SITE_NAME} infringes your copyright, send a written
notice to **${CONTACT_EMAIL}** with the subject line "DMCA Notice", including:

1. Your physical or electronic signature.
2. Identification of the copyrighted work you claim has been infringed.
3. Identification of the material that you claim is infringing, with enough detail
   for us to locate it (e.g. the URL on ${SITE_NAME}).
4. Your name, address, telephone number, and email address.
5. A statement that you have a good-faith belief that the disputed use is not
   authorized by the copyright owner, its agent, or the law.
6. A statement, made under penalty of perjury, that the information in your notice
   is accurate and that you are the copyright owner or authorized to act on the
   owner's behalf.

Please note that under Section 512(f) of the DMCA, you may be liable for damages if
you knowingly misrepresent that material is infringing.

## Our process

On receiving a valid notice, we will remove or disable access to the material in
question and make a reasonable effort to notify the user who posted it. We may
terminate the accounts of repeat infringers.

## Counter-notice

If you believe your content was removed in error or misidentification, you may send
a counter-notice to **${CONTACT_EMAIL}** including:

1. Your physical or electronic signature.
2. Identification of the material that was removed and the location where it
   appeared before removal.
3. A statement, under penalty of perjury, that you have a good-faith belief the
   material was removed as a result of mistake or misidentification.
4. Your name, address, and telephone number, and a statement that you consent to
   the jurisdiction of the appropriate court and will accept service of process
   from the party that filed the original notice.

If we receive a valid counter-notice, we may restore the removed material in line
with the DMCA, unless the original complainant files a court action.

## Contact

Copyright agent: ${OPERATOR} — **${CONTACT_EMAIL}**.
`;

export default function DmcaPage() {
  return <LegalPage title="Copyright / DMCA Policy" body={BODY} />;
}
