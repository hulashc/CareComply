import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { rateLimit } from "@/lib/rate-limit";
import { verifyOrgOwnership } from "@/lib/services/ownership";

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const rl = await rateLimit(`medication-logs:${admin.id}`, 10);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { medication_id, carer_id, status, notes } = body;
  if (!medication_id) return NextResponse.json({ error: "Medication ID required" }, { status: 400 });

  const supabase = createAdminClient();

  if (!await verifyOrgOwnership(supabase, "medications", medication_id, admin.org_id ?? "")) {
    return NextResponse.json({ error: "Medication not found" }, { status: 404 });
  }
  if (carer_id && !await verifyOrgOwnership(supabase, "carers", carer_id, admin.org_id ?? "")) {
    return NextResponse.json({ error: "Carer not found" }, { status: 404 });
  }

  const { error } = await supabase.from("medication_logs").insert({
    medication_id, carer_id: carer_id || null, org_id: admin.org_id,
    status: status || "given", notes: notes || null,
  });
  if (error) return NextResponse.json({ error: "Failed to create medication log" }, { status: 500 });
  return NextResponse.json({ success: true });
}
