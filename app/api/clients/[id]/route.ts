import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/services/audit-service";
import { clientProfileSchema } from "@/lib/schemas/client-profile";
import { clientContactRows, clientToRow, createProfileDb } from "@/lib/services/profile-service";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin?.org_id) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const rl = await rateLimit(`clients-update:${admin.id}`, 30);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = clientProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
      { status: 400 },
    );
  }

  const db = createProfileDb();
  const { data: updated, error } = await db
    .from("clients")
    .update(clientToRow(parsed.data))
    .eq("id", id)
    .eq("org_id", admin.org_id)
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Failed to update client" }, { status: 500 });
  if (!updated) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const { error: delErr } = await db.from("client_contacts").delete().eq("client_id", id).eq("org_id", admin.org_id);
  if (delErr) return NextResponse.json({ error: "Failed to update client contacts" }, { status: 500 });
  const contacts = clientContactRows(parsed.data, admin.org_id, id);
  if (contacts.length > 0) {
    const { error: insErr } = await db.from("client_contacts").insert(contacts);
    if (insErr) return NextResponse.json({ error: "Failed to update client contacts" }, { status: 500 });
  }

  await logAudit({ action: "client.update", entityType: "client", entityId: id, actorId: admin.id, orgId: admin.org_id });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin?.org_id) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const rl = await rateLimit(`clients-delete:${admin.id}`, 5);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { id } = await params;
  const supabase = createAdminClient();
  const { error } = await supabase.from("clients").delete().eq("id", id).eq("org_id", admin.org_id);
  if (error) return NextResponse.json({ error: "Failed to delete client" }, { status: 500 });
  return NextResponse.json({ success: true });
}
