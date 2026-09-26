import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const adminClient = createAdminClient();

  const { data: application, error } = await adminClient
    .from("applications")
    .select("id, full_name, email, status, org_id, invite_expires_at")
    .eq("invite_token", token)
    .maybeSingle();

  if (error || !application) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  if (application.invite_expires_at && new Date(application.invite_expires_at) < new Date()) {
    return NextResponse.json({ error: "This invitation has expired" }, { status: 410 });
  }

  if (application.status === "approved" || application.status === "rejected") {
    return NextResponse.json(
      { error: "This application has already been reviewed" },
      { status: 410 }
    );
  }

  return NextResponse.json({ application });
}