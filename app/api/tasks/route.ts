import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { rateLimit } from "@/lib/rate-limit";
import { verifyOrgOwnership } from "@/lib/services/ownership";

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const rl = await rateLimit(`tasks:${admin.id}`, 10);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { client_id, title, description, category, priority, due_date } = body;
  if (!client_id || !title) return NextResponse.json({ error: "Client ID and title required" }, { status: 400 });

  const supabase = createAdminClient();

  if (!await verifyOrgOwnership(supabase, "clients", client_id, admin.org_id ?? "")) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const { error } = await supabase.from("tasks").insert({
    client_id, org_id: admin.org_id, title, description: description || null,
    category: category || "general", priority: priority || "medium", status: "pending",
    due_date: due_date || null,
  });
  if (error) return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  return NextResponse.json({ success: true });
}
