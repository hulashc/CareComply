import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { sendRejectionEmail } from "@/lib/services/notification-service";
import { logAudit } from "@/lib/services/audit-service";
import type { Tables } from "@/lib/database.types";
import { rateLimit } from "@/lib/rate-limit";

type ApplicationRow = Tables<"applications">;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const rl = await rateLimit(`reject-application:${admin.id}`, 10);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let reason: string | undefined;
  try {
    ({ reason } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const adminClient = createAdminClient();

  const { data: application } = await adminClient
    .from("applications")
    .select("id, status, email, full_name")
    .eq("id", id)
    .eq("org_id", admin.org_id ?? "")
    .maybeSingle()
    .returns<Pick<ApplicationRow, "id" | "status" | "email" | "full_name">>();

  if (!application || application.status !== "pending_review") {
    return NextResponse.json({ error: "Application not found or not pending review" }, { status: 400 });
  }

  const { error } = await adminClient
    .from("applications")
    .update({
      status: "rejected",
      rejection_reason: reason || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("org_id", admin.org_id ?? "");

  if (error) {
    return NextResponse.json({ error: "Failed to reject application" }, { status: 500 });
  }

  sendRejectionEmail(application.email, application.full_name, reason).catch(() => {});
  logAudit({ action: "application_rejected", entityType: "application", entityId: id, actorId: admin.id, orgId: admin.org_id, details: `Rejected ${application.full_name}${reason ? `: ${reason}` : ""}` }).catch(() => {});

  return NextResponse.json({ success: true });
}
