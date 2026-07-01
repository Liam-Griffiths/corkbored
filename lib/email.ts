// Email sending via Resend, behind two independent feature flags:
//
//   EMAIL_ENABLED                — master switch for the provider. When this is
//                                  not "true" (or no RESEND_API_KEY is set),
//                                  every send is logged instead of delivered.
//                                  Lets us ship email-sending code without
//                                  turning on real delivery.
//   NOTIFICATION_EMAILS_ENABLED  — gates the "notification" category only
//                                  (application updates, announcements). These
//                                  can fan out to many recipients, so they stay
//                                  off until explicitly enabled. Transactional
//                                  emails (e.g. project invites) ignore it.
//
// HUMAN TASK: Resend account + domain DNS verification for corkbored.com before
// EMAIL_ENABLED=true will actually deliver.

type EmailPayload = {
  to: string;
  subject: string;
  text: string;
};

// Transactional = user-initiated, expected, low volume (always send when the
// provider is on). Notification = system-generated fan-out (gated separately).
type EmailCategory = "transactional" | "notification";

function providerEnabled(): boolean {
  return process.env.EMAIL_ENABLED === "true" && !!process.env.RESEND_API_KEY;
}

// Exported so callers can skip expensive recipient lookups (e.g. fanning out an
// announcement to every member) when notification emails are turned off. The
// send() path re-checks this regardless, so this is purely an optimization.
export function notificationEmailsEnabled(): boolean {
  return process.env.NOTIFICATION_EMAILS_ENABLED === "true";
}

// Returns true only when the email was actually handed off to the provider.
// Returns false when a flag suppressed it (logged instead). Throws on a real
// provider error so callers can distinguish "suppressed" from "failed".
async function send(
  payload: EmailPayload,
  category: EmailCategory = "transactional",
): Promise<boolean> {
  if (!providerEnabled()) {
    console.log(
      `[email] provider disabled (${category}) — would send:`,
      JSON.stringify(payload, null, 2),
    );
    return false;
  }

  if (category === "notification" && !notificationEmailsEnabled()) {
    console.log(
      `[email] notification emails disabled — skipping: "${payload.subject}" → ${payload.to}`,
    );
    return false;
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

  return true;
}

export async function sendApplicationReceived(opts: {
  ownerEmail: string;
  applicantName: string;
  projectTitle: string;
  roleName: string;
  dashboardUrl: string;
}): Promise<void> {
  await send(
    {
      to: opts.ownerEmail,
      subject: `New application for ${opts.roleName} on ${opts.projectTitle}`,
      text: `Hi,\n\n${opts.applicantName} just applied for the "${opts.roleName}" role on ${opts.projectTitle}.\n\nReview their application:\n${opts.dashboardUrl}\n\n— Corkbored`,
    },
    "notification",
  );
}

export async function sendApplicationDecided(opts: {
  applicantEmail: string;
  decision: "accepted" | "declined";
  projectTitle: string;
  roleName: string;
  projectUrl: string;
}): Promise<void> {
  const accepted = opts.decision === "accepted";
  await send(
    {
      to: opts.applicantEmail,
      subject: `Your application to ${opts.projectTitle} was ${opts.decision}`,
      text: accepted
        ? `Great news! Your application for "${opts.roleName}" on ${opts.projectTitle} was accepted.\n\nHead to the project:\n${opts.projectUrl}\n\n— Corkbored`
        : `Thanks for applying. Your application for "${opts.roleName}" on ${opts.projectTitle} wasn't selected this time.\n\nKeep exploring projects on the board.\n\n— Corkbored`,
    },
    "notification",
  );
}

// Returns whether the invite email was actually delivered, so the caller can
// fall back to surfacing the link for manual sharing.
export async function sendProjectInvite(opts: {
  to: string;
  inviterName: string;
  projectTitle: string;
  roleName: string;
  inviteUrl: string;
}): Promise<boolean> {
  return send({
    to: opts.to,
    subject: `${opts.inviterName} invited you to join ${opts.projectTitle} on Corkbored`,
    text: `Hi,\n\n${opts.inviterName} invited you to join "${opts.projectTitle}" as a ${opts.roleName}.\n\nAccept the invite (sign in with GitHub — we'll create your account if you don't have one yet):\n${opts.inviteUrl}\n\nThis link expires in 14 days.\n\n— Corkbored`,
  });
}

// Transactional: a direct response to the user's own export request, so it sends
// whenever the provider is on (ignores the notification-email flag).
export async function sendDataExportReady(opts: {
  to: string;
  downloadUrl: string;
}): Promise<boolean> {
  return send({
    to: opts.to,
    subject: "Your Corkbored data export is ready",
    text: `Hi,\n\nThe copy of your Corkbored data you requested is ready to download.\n\nSign in and download it here:\n${opts.downloadUrl}\n\nFor security, this link expires in 7 days. If you didn't request this, you can ignore this email or contact privacy@corkbored.com.\n\n— Corkbored`,
  });
}

export async function sendNewAnnouncement(opts: {
  memberEmail: string;
  projectTitle: string;
  announcementTitle: string;
  projectUrl: string;
}): Promise<void> {
  await send(
    {
      to: opts.memberEmail,
      subject: `${opts.projectTitle}: ${opts.announcementTitle}`,
      text: `New announcement on ${opts.projectTitle}:\n\n"${opts.announcementTitle}"\n\nRead more:\n${opts.projectUrl}\n\n— Corkbored`,
    },
    "notification",
  );
}
