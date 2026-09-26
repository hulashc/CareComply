import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  let body: { orgName?: string; fullName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const adminClient = createAdminClient();
  const { data: admin } = await adminClient.from("admins").select("id, org_id").eq("id", userId).maybeSingle();
  if (!admin?.org_id) return NextResponse.json({ error: "Admin not found" }, { status: 404 });

  const orgName = body.orgName?.trim();
  const fullName = body.fullName?.trim();

  if (orgName) {
    await adminClient.from("organizations").update({ name: orgName }).eq("id", admin.org_id);
  }
  if (fullName) {
    await adminClient.from("admins").update({ full_name: fullName }).eq("id", userId);
  }

  return NextResponse.json({ success: true });
}
