import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendDocumentExpiryAlert } from "@/lib/services/notification-service";
import type { Tables } from "@/lib/database.types";

type ExpiringDoc = Tables<"documents"> & {
  carers: { email: string | null; full_name: string | null } | null;
  document_types: { name: string } | null;
};

export async function GET(req: NextRequest) {
  const cronSecret = req.headers.get("x-cron-secret");
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret || cronSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const dateStr = thirtyDaysFromNow.toISOString().split("T")[0];

  const { data: expiringDocs } = await supabase
    .from("documents")
    .select("*, carers(email, full_name), document_types(name)")
    .eq("status", "amber")
    .is("deleted_at", null)
    .lte("expiry_date", dateStr)
    .limit(50)
    .returns<ExpiringDoc[]>();

  let sent = 0;
  if (expiringDocs) {
    for (const doc of expiringDocs) {
      const carerEmail = doc.carers?.email;
      const carerName = doc.carers?.full_name ?? "Unknown";
      const docName = doc.document_types?.name ?? "Document";
      const expiresAt = doc.expiry_date ? new Date(doc.expiry_date) : new Date();
      const daysLeft = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

      if (carerEmail) {
        await sendDocumentExpiryAlert(carerEmail, carerName, docName, daysLeft);
        sent++;
      }
    }
  }

  return NextResponse.json({ success: true, sent, checked: expiringDocs?.length ?? 0 });
}
