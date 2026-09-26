import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const rl = await rateLimit(`medications:${admin.id}`, 10);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { client_id, drug_name, dosage, frequency, route, start_date, end_date, prescribed_by, notes } = body;
  if (!client_id || !drug_name || !dosage || !frequency) return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase.from("medications").insert({
    client_id, org_id: admin.org_id, drug_name, dosage, frequency,
    route: route || "oral", start_date, end_date: end_date || null,
    prescribed_by: prescribed_by || null, notes: notes || null, status: "active",
  });
  if (error) return NextResponse.json({ error: "Failed to create medication" }, { status: 500 });
  return NextResponse.json({ success: true });
}
