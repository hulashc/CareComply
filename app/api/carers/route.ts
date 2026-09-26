import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/services/auth-guard";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin.org_id) {
      return NextResponse.json({ error: "Admin organization not found" }, { status: 404 });
    }

    let body: {
      fullName?: string;
      email?: string;
      phone?: string;
      role?: string;
      startDate?: string;
      notes?: string;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase.from("carers").insert({
      org_id: admin.org_id!,
      full_name: body.fullName ?? "Unknown",
      email: body.email || null,
      phone: body.phone || null,
      role: body.role || "carer",
      start_date: body.startDate ?? null,
      notes: body.notes || null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Admin access required") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
