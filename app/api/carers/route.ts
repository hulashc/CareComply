import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/services/audit-service";
import { carerProfileSchema } from "@/lib/schemas/carer-profile";
import { carerChildRows, carerToRow, createProfileDb } from "@/lib/services/profile-service";

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin?.org_id) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const rl = await rateLimit(`carers-create:${admin.id}`, 20);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

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
  const { data: carer, error } = await db
    .from("carers")
    .insert({ org_id: admin.org_id, ...row })
    .select("id")
    .single();
  if (error || !carer) return NextResponse.json({ error: "Failed to create carer" }, { status: 500 });

  const { contacts, references } = carerChildRows(parsed.data, admin.org_id, carer.id);
  const results = await Promise.all([
    contacts.length ? db.from("carer_contacts").insert(contacts) : null,
    references.length ? db.from("carer_references").insert(references) : null,
  ]);
  if (results.some((r) => r?.error)) {
    await db.from("carers").delete().eq("id", carer.id).eq("org_id", admin.org_id);
    return NextResponse.json({ error: "Failed to save carer contacts or references" }, { status: 500 });
  }

  await logAudit({ action: "carer.create", entityType: "carer", entityId: carer.id, actorId: admin.id, orgId: admin.org_id });
  return NextResponse.json({ success: true, id: carer.id });
}
