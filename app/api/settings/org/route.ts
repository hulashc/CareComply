import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/lib/services/auth-guard";

export async function PATCH(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  let body: { orgName?: string; fullName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const orgName = body.orgName?.trim();
  const fullName = body.fullName?.trim();

  if (orgName && admin.org_id) {
    const { error } = await supabase.from("organizations").update({ name: orgName }).eq("id", admin.org_id);
    if (error) return NextResponse.json({ error: "Failed to update organisation" }, { status: 500 });
  }

  if (fullName) {
    const { error } = await supabase.from("admins").update({ full_name: fullName }).eq("id", admin.id);
    if (error) return NextResponse.json({ error: "Failed to update name" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
