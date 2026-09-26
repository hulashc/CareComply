import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { rateLimit } from "@/lib/rate-limit";

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .eq("org_id", admin.org_id ?? "")
    .order("name");

  if (error) return NextResponse.json({ error: "Failed to fetch locations" }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const rl = await rateLimit(`locations:${admin.id}`, 10);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const { name, address, phone, email } = body;
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("locations")
    .insert({ org_id: admin.org_id ?? "", name, address: address || null, phone: phone || null, email: email || null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: "Failed to create location" }, { status: 500 });
  return NextResponse.json(data);
}
