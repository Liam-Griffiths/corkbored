// Email sending via Resend.
// HUMAN TASK: Resend account + domain DNS verification for corkbored.com.
// Until DNS is verified, set RESEND_TEST_MODE=true to log payloads instead of sending.

type EmailPayload = {
  to: string;
  subject: string;
  text: string;
};

async function send(payload: EmailPayload): Promise<void> {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_TEST_MODE === "true") {
    console.log("[email] TEST MODE — would send:", JSON.stringify(payload, null, 2));
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Corkbored <hello@corkbored.com>",
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error ${res.status}: ${err}`);
  }
}

export async function sendApplicationReceived(opts: {
  ownerEmail: string;
  applicantName: string;
  projectTitle: string;
  roleName: string;
  dashboardUrl: string;
}): Promise<void> {
  await send({
    to: opts.ownerEmail,
    subject: `New application for ${opts.roleName} on ${opts.projectTitle}`,
    text: `Hi,\n\n${opts.applicantName} just applied for the "${opts.roleName}" role on ${opts.projectTitle}.\n\nReview their application:\n${opts.dashboardUrl}\n\n— Corkbored`,
  });
}

export async function sendApplicationDecided(opts: {
  applicantEmail: string;
  decision: "accepted" | "declined";
  projectTitle: string;
  roleName: string;
  projectUrl: string;
}): Promise<void> {
  const accepted = opts.decision === "accepted";
  await send({
    to: opts.applicantEmail,
    subject: `Your application to ${opts.projectTitle} was ${opts.decision}`,
    text: accepted
      ? `Great news! Your application for "${opts.roleName}" on ${opts.projectTitle} was accepted.\n\nHead to the project:\n${opts.projectUrl}\n\n— Corkbored`
      : `Thanks for applying. Your application for "${opts.roleName}" on ${opts.projectTitle} wasn't selected this time.\n\nKeep exploring projects on the board.\n\n— Corkbored`,
  });
}

export async function sendNewAnnouncement(opts: {
  memberEmail: string;
  projectTitle: string;
  announcementTitle: string;
  projectUrl: string;
}): Promise<void> {
  await send({
    to: opts.memberEmail,
    subject: `${opts.projectTitle}: ${opts.announcementTitle}`,
    text: `New announcement on ${opts.projectTitle}:\n\n"${opts.announcementTitle}"\n\nRead more:\n${opts.projectUrl}\n\n— Corkbored`,
  });
}
