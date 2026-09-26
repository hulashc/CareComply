import type { Job } from "./queue";
import {
  sendInviteEmail,
  sendApprovalEmail,
  sendRejectionEmail,
  sendCarerWelcomeEmail,
  sendDocumentExpiryAlert,
  sendSubscriptionConfirmation,
} from "@/lib/services/notification-service";

export async function processEmailJob(job: Job): Promise<void> {
  const p = job.payload;

  switch (job.type) {
    case "email:invite":
      await sendInviteEmail(p.email as string, p.link as string, p.name as string);
      break;
    case "email:approval":
      await sendApprovalEmail(p.email as string, p.name as string);
      break;
    case "email:rejection":
      await sendRejectionEmail(p.email as string, p.name as string, p.reason as string | undefined);
      break;
    case "email:welcome":
      await sendCarerWelcomeEmail(p.email as string, p.name as string, p.resetLink as string);
      break;
    case "email:expiry_alert":
      await sendDocumentExpiryAlert(p.email as string, p.carerName as string, p.documentName as string, p.daysLeft as number);
      break;
    case "email:subscription":
      await sendSubscriptionConfirmation(p.email as string, p.adminName as string, p.seats as number, p.monthlyCost as number);
      break;
    default:
      throw new Error(`Unknown email job type: ${job.type}`);
  }
}
