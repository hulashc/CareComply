import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { rateLimit } from "@/lib/rate-limit";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin?.org_id) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const rl = await rateLimit(`documents-delete:${admin.id}`, 5);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { id } = await params;
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("documents")
    .update({ deleted_at: new Date().toISOString(), deleted_by: admin.id })
    .eq("id", id)
    .eq("org_id", admin.org_id)
    .is("deleted_at", null);
  if (error) return NextResponse.json({ error: "Failed to delete document" }, { status: 500 });
  return NextResponse.json({ success: true });
}
