import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/services/audit-service";
import { clientProfileSchema } from "@/lib/schemas/client-profile";
import { clientContactRows, clientToRow, createProfileDb } from "@/lib/services/profile-service";

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin?.org_id) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const rl = await rateLimit(`clients-create:${admin.id}`, 20);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

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
  const { data: client, error } = await db
    .from("clients")
    .insert({ org_id: admin.org_id, ...clientToRow(parsed.data) })
    .select("id")
    .single();
  if (error || !client) {
    return NextResponse.json({ error: "Failed to create client" }, { status: 500 });
  }

  const contacts = clientContactRows(parsed.data, admin.org_id, client.id);
  if (contacts.length > 0) {
    const { error: cErr } = await db.from("client_contacts").insert(contacts);
    if (cErr) {
      // Roll back so we never leave a client without its contacts.
      await db.from("clients").delete().eq("id", client.id).eq("org_id", admin.org_id);
      return NextResponse.json({ error: "Failed to save client contacts" }, { status: 500 });
    }
  }

  await logAudit({
    action: "client.create",
    entityType: "client",
    entityId: client.id,
    actorId: admin.id,
    orgId: admin.org_id,
  });
  return NextResponse.json({ success: true, id: client.id });
}
