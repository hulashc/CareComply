import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { rateLimit } from "@/lib/rate-limit";
import { verifyOrgOwnership } from "@/lib/services/ownership";

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const rl = await rateLimit(`handovers:${admin.id}`, 10);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { client_id, from_carer_id, to_carer_id, shift_id, note_text, mood, concerns, tasks_completed, tasks_remaining } = body;
  if (!client_id || !note_text) return NextResponse.json({ error: "Client and note text required" }, { status: 400 });

  const supabase = createAdminClient();

  if (!await verifyOrgOwnership(supabase, "clients", client_id, admin.org_id ?? "")) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  if (from_carer_id && !await verifyOrgOwnership(supabase, "carers", from_carer_id, admin.org_id ?? "")) {
    return NextResponse.json({ error: "Carer not found" }, { status: 404 });
  }
  if (to_carer_id && !await verifyOrgOwnership(supabase, "carers", to_carer_id, admin.org_id ?? "")) {
    return NextResponse.json({ error: "Carer not found" }, { status: 404 });
  }

  const { error } = await supabase.from("handover_notes").insert({
    client_id, org_id: admin.org_id,
    from_carer_id: from_carer_id || null,
    to_carer_id: to_carer_id || null,
    shift_id: shift_id || null,
    note_text, mood: mood || null,
    concerns: concerns || null,
    tasks_completed: tasks_completed || null,
    tasks_remaining: tasks_remaining || null,
  });
  if (error) return NextResponse.json({ error: "Failed to create handover note" }, { status: 500 });
  return NextResponse.json({ success: true });
}
