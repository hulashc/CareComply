import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { rateLimit } from "@/lib/rate-limit";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getCurrentAdmin();
  if (!admin?.org_id) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const rl = await rateLimit(`absences-patch:${admin.id}`, 10);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { id } = await params;
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { status } = body;
  if (!status || !["approved", "rejected"].includes(status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase.from("absences").update(
    status === "approved"
      ? { status: "approved", approved_by: admin.id, approved_at: new Date().toISOString() }
      : { status: "rejected" }
  ).eq("id", id).eq("org_id", admin.org_id);
  if (error) return NextResponse.json({ error: "Failed to update absence" }, { status: 500 });
  return NextResponse.json({ success: true });
}
