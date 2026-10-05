import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { rateLimit } from "@/lib/rate-limit";
import { verifyOrgOwnership } from "@/lib/services/ownership";

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const rl = await rateLimit(`care-notes:${admin.id}`, 10);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { client_id, carer_id, note_type, note_text, mood, fluids, nutrition } = body;

  if (!client_id || !note_text) {
    return NextResponse.json({ error: "Client ID and note text are required" }, { status: 400 });
  }

  const adminClient = createAdminClient();

  if (!await verifyOrgOwnership(adminClient, "clients", client_id, admin.org_id ?? "")) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  if (carer_id && !await verifyOrgOwnership(adminClient, "carers", carer_id, admin.org_id ?? "")) {
    return NextResponse.json({ error: "Carer not found" }, { status: 404 });
  }

  const { error } = await adminClient.from("care_notes").insert({
    client_id,
    carer_id: carer_id || null,
    org_id: admin.org_id,
    note_type: note_type || "observation",
    note_text,
    mood: mood || null,
    fluids: fluids || null,
    nutrition: nutrition || null,
  });

  if (error) {
    return NextResponse.json({ error: "Failed to create care note" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
