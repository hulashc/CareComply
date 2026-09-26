import { Resend } from "resend";
import { dispatchJob } from "@/lib/jobs/queue";

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

async function dispatchOrSend(
  jobType: Parameters<typeof dispatchJob>[0],
  payload: Record<string, unknown>,
  directSend: () => Promise<void>,
): Promise<void> {
  const jobId = await dispatchJob(jobType, payload);
  if (!jobId) {
    await directSend();
  }
}

export async function sendInviteEmail(email: string | null, link: string, applicantName: string) {
  await dispatchOrSend(
    "email:invite",
    { email, link, name: applicantName },
    async () => {
      const resend = getResend();
      if (!email || !resend) { console.log(`[Email] Invite for ${applicantName}: ${link}`); return; }
      await resend.emails.send({ from: "CareComply <noreply@carecomply.app>", to: email, subject: `${applicantName}, complete your application`, html: `<p>Hi ${escapeHtml(applicantName)},</p><p>Please complete your application form using the link below:</p><p><a href="${link}">${link}</a></p><p>This link is secure and unique to you.</p><p>CareComply</p>` });
    },
  );
}

export async function sendApprovalEmail(email: string | null, applicantName: string) {
  await dispatchOrSend(
    "email:approval",
    { email, name: applicantName },
    async () => {
      const resend = getResend();
      if (!email || !resend) { console.log(`[Email] Application approved for ${applicantName}`); return; }
      await resend.emails.send({ from: "CareComply <noreply@carecomply.app>", to: email, subject: "Your application has been approved", html: `<p>Hi ${escapeHtml(applicantName)},</p><p>Your application has been approved. Welcome to the team!</p><p>CareComply</p>` });
    },
  );
}

export async function sendRejectionEmail(email: string | null, applicantName: string, reason?: string) {
  await dispatchOrSend(
    "email:rejection",
    { email, name: applicantName, reason },
    async () => {
      const resend = getResend();
      if (!email || !resend) { console.log(`[Email] Rejected for ${applicantName}: ${reason ?? "No reason"}`); return; }
      await resend.emails.send({ from: "CareComply <noreply@carecomply.app>", to: email, subject: "Update on your application", html: `<p>Hi ${escapeHtml(applicantName)},</p><p>Your application was not approved at this time.${reason ? ` Reason: ${escapeHtml(reason)}` : ""}</p><p>CareComply</p>` });
    },
  );
}

export async function sendCarerWelcomeEmail(email: string, carerName: string, resetLink: string) {
  await dispatchOrSend(
    "email:welcome",
    { email, name: carerName, resetLink },
    async () => {
      const resend = getResend();
      if (!resend) { console.log(`[Email] Welcome for ${carerName}: ${resetLink}`); return; }
      await resend.emails.send({ from: "CareComply <noreply@carecomply.app>", to: email, subject: "Welcome to CareComply — Set Your Password", html: `<p>Hi ${escapeHtml(carerName)},</p><p>Your application has been approved! Welcome to the team.</p><p><a href="${resetLink}">Click here to set your password and access your carer portal.</a></p><p>CareComply</p>` });
    },
  );
}

export async function sendDocumentExpiryAlert(email: string, carerName: string, documentName: string, daysLeft: number) {
  await dispatchOrSend(
    "email:expiry_alert",
    { email, carerName, documentName, daysLeft },
    async () => {
      const resend = getResend();
      if (!resend) { console.log(`[Email] Expiry: ${documentName} for ${carerName} expires in ${daysLeft} days`); return; }
      await resend.emails.send({ from: "CareComply <noreply@carecomply.app>", to: email, subject: `Document expiring: ${escapeHtml(documentName)}`, html: `<p>${escapeHtml(carerName)}'s ${escapeHtml(documentName)} expires in ${daysLeft} days. Please take action.</p><p>CareComply</p>` });
    },
  );
}

export async function sendSubscriptionConfirmation(email: string, adminName: string, seats: number, monthlyCost: number) {
  await dispatchOrSend(
    "email:subscription",
    { email, adminName, seats, monthlyCost },
    async () => {
      const resend = getResend();
      if (!resend) { console.log(`[Email] Subscription confirmed: ${seats} seats at £${monthlyCost}/mo for ${email}`); return; }
      await resend.emails.send({
        from: "CareComply <noreply@carecomply.app>",
        to: email,
        subject: `Your CareComply subscription is active`,
        html: `<p>Hi ${escapeHtml(adminName)},</p><p>Your subscription is now active — <strong>${seats} seat${seats !== 1 ? "s" : ""}</strong> at <strong>£${monthlyCost}/month</strong>.</p><p><strong>What's next?</strong></p><ol><li>Add your carers and invite them to the platform</li><li>Set up your clients with care plans and medications</li><li>Schedule shifts so your team knows their roster</li></ol><p>Need help? Reply to this email and we'll be happy to assist.</p><p>CareComply — CQC-ready compliance for care homes.</p>`,
      });
    },
  );
}
