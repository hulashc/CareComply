import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { rateLimit } from "@/lib/rate-limit";
import { verifyOrgOwnership } from "@/lib/services/ownership";

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const rl = await rateLimit(`assessments:${admin.id}`, 10);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { client_id, title, category, scores, notes, next_review_date } = body;
  if (!client_id || !title) return NextResponse.json({ error: "Client ID and title required" }, { status: 400 });

  const supabase = createAdminClient();

  if (!await verifyOrgOwnership(supabase, "clients", client_id, admin.org_id ?? "")) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const { error } = await supabase.from("assessments").insert({
    client_id, org_id: admin.org_id, title, category: category || "initial",
    scores: scores || {}, notes: notes || null, status: "completed",
    assessed_by: admin.id, next_review_date: next_review_date || null,
  });
  if (error) return NextResponse.json({ error: "Failed to create assessment" }, { status: 500 });
  return NextResponse.json({ success: true });
}
