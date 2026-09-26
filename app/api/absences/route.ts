import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { rateLimit } from "@/lib/rate-limit";
import { verifyOrgOwnership } from "@/lib/services/ownership";

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const rl = await rateLimit(`absences:${admin.id}`, 10);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { carer_id, absence_type, start_date, end_date, reason } = body;
  if (!carer_id || !start_date || !end_date) return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  if (new Date(end_date) < new Date(start_date)) return NextResponse.json({ error: "End date must be after start date" }, { status: 400 });

  const supabase = createAdminClient();

  if (!await verifyOrgOwnership(supabase, "carers", carer_id, admin.org_id ?? "")) {
    return NextResponse.json({ error: "Carer not found" }, { status: 404 });
  }

  const { error } = await supabase.from("absences").insert({
    carer_id, org_id: admin.org_id,
    absence_type: absence_type || "sick_leave",
    start_date, end_date, reason: reason || null,
    status: "pending",
  });
  if (error) return NextResponse.json({ error: "Failed to record absence" }, { status: 500 });
  return NextResponse.json({ success: true });
}
