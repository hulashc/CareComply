import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { logAudit } from "@/lib/services/audit-service";
import { rateLimit } from "@/lib/rate-limit";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin?.org_id) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const rl = await rateLimit(`incidents-patch:${admin.id}`, 10);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { id } = await params;
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { status } = body;
  if (!status) return NextResponse.json({ error: "Status is required" }, { status: 400 });
  const supabase = createAdminClient();
  const { error } = await supabase.from("incidents").update(status === "resolved" ? { status: "resolved", resolved_at: new Date().toISOString() } : { status }).eq("id", id).eq("org_id", admin.org_id);
  if (error) return NextResponse.json({ error: "Failed to update incident" }, { status: 500 });
  logAudit({ action: "incident_resolved", entityType: "incident", entityId: id, actorId: admin.id, orgId: admin.org_id }).catch(() => {});
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin?.org_id) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const rl = await rateLimit(`incidents-delete:${admin.id}`, 5);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { id } = await params;
  const supabase = createAdminClient();
  const { error } = await supabase.from("incidents").delete().eq("id", id).eq("org_id", admin.org_id);
  if (error) return NextResponse.json({ error: "Failed to delete incident" }, { status: 500 });
  return NextResponse.json({ success: true });
}
