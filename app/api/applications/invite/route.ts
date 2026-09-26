import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { sendInviteEmail } from "@/lib/services/notification-service";
import { logAudit } from "@/lib/services/audit-service";
import { randomBytes } from "crypto";
import { rateLimit } from "@/lib/rate-limit";
import type { TablesInsert } from "@/lib/database.types";

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const rl = await rateLimit(`invite:${admin.id}`, 10);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetIn / 1000)) } });

  let fullName: string | undefined;
  let email: string | undefined;
  try {
    ({ fullName, email } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!fullName) {
    return NextResponse.json({ error: "Full name is required" }, { status: 400 });
  }

  const token = randomBytes(24).toString("hex");
  const adminClient = createAdminClient();

  const { data: application, error } = await adminClient
    .from("applications")
    .insert({
      org_id: admin.org_id,
      invite_token: token,
      full_name: fullName,
      email: email || null,
      status: "invited",
    } as TablesInsert<"applications">)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to create invitation" }, { status: 500 });
  }

  const link = `${process.env.NEXT_PUBLIC_APP_URL}/apply/${token}`;

  sendInviteEmail(email || null, link, fullName).catch(() => {});
  logAudit({ action: "application_invited", entityType: "application", entityId: application?.id, actorId: admin.id, orgId: admin.org_id, details: `Invited ${fullName}` }).catch(() => {});

  return NextResponse.json({ application, link });
}
