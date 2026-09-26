import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { rateLimit } from "@/lib/rate-limit";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const rl = await rateLimit(`delete-application:${admin.id}`, 5);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { id } = await params;
  const supabase = createAdminClient();

  const { data: app } = await supabase
    .from("applications")
    .select("id")
    .eq("id", id)
    .eq("org_id", admin.org_id ?? "")
    .maybeSingle();

  if (!app) return NextResponse.json({ error: "Application not found" }, { status: 404 });

  await supabase.from("application_documents").delete().eq("application_id", id);
  const { error } = await supabase.from("applications").delete().eq("id", id).eq("org_id", admin.org_id ?? "");
  if (error) return NextResponse.json({ error: "Failed to delete application" }, { status: 500 });
  return NextResponse.json({ success: true });
}
