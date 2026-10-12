import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/services/audit-service";
import { carerProfileSchema } from "@/lib/schemas/carer-profile";
import { carerChildRows, carerToRow, createProfileDb } from "@/lib/services/profile-service";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin?.org_id) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const rl = await rateLimit(`carers-update:${admin.id}`, 30);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = carerProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
      { status: 400 },
    );
  }

  let row: Record<string, unknown>;
  try {
    row = carerToRow(parsed.data);
  } catch (e) {
    console.error("[carers] encryption failed:", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "Secure storage is not configured (FIELD_ENCRYPTION_KEY). Contact your administrator." },
      { status: 500 },
    );
  }

  const db = createProfileDb();
  const { data: updated, error } = await db
    .from("carers")
    .update(row)
    .eq("id", id)
    .eq("org_id", admin.org_id)
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Failed to update carer" }, { status: 500 });
  if (!updated) return NextResponse.json({ error: "Carer not found" }, { status: 404 });

  const { contacts, references } = carerChildRows(parsed.data, admin.org_id, id);
  const deletes = await Promise.all([
    db.from("carer_contacts").delete().eq("carer_id", id).eq("org_id", admin.org_id),
    db.from("carer_references").delete().eq("carer_id", id).eq("org_id", admin.org_id),
  ]);
  if (deletes.some((r) => r.error)) return NextResponse.json({ error: "Failed to update carer contacts" }, { status: 500 });
  const inserts = await Promise.all([
    contacts.length ? db.from("carer_contacts").insert(contacts) : null,
    references.length ? db.from("carer_references").insert(references) : null,
  ]);
  if (inserts.some((r) => r?.error)) return NextResponse.json({ error: "Failed to update carer contacts" }, { status: 500 });

  await logAudit({ action: "carer.update", entityType: "carer", entityId: id, actorId: admin.id, orgId: admin.org_id });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin?.org_id) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const rl = await rateLimit(`carers-delete:${admin.id}`, 5);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { id } = await params;
  const supabase = createAdminClient();
  const { error } = await supabase.from("carers").delete().eq("id", id).eq("org_id", admin.org_id);
  if (error) return NextResponse.json({ error: "Failed to delete carer" }, { status: 500 });
  return NextResponse.json({ success: true });
}
