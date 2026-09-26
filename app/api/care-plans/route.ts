import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { rateLimit } from "@/lib/rate-limit";
import { verifyOrgOwnership } from "@/lib/services/ownership";

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const rl = await rateLimit(`care-plans:${admin.id}`, 10);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { client_id, title, goals, interventions, notes, review_date } = body;
  if (!client_id || !title) return NextResponse.json({ error: "Client ID and title required" }, { status: 400 });

  const supabase = createAdminClient();

  if (!await verifyOrgOwnership(supabase, "clients", client_id, admin.org_id ?? "")) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const { error } = await supabase.from("care_plans").insert({
    client_id, org_id: admin.org_id, title, goals: goals || null,
    interventions: interventions || null, notes: notes || null,
    review_date: review_date || null, status: "active", created_by: admin.id,
  });
  if (error) return NextResponse.json({ error: "Failed to create care plan" }, { status: 500 });
  return NextResponse.json({ success: true });
}
