import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { NextRequest } from "next/server";

async function getSvc() {
  const cookieStore = await cookies();
  const authClient = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return null;
  const svc = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data: carer } = await svc.from("carers").select("id").eq("auth_id", user.id).single();
  if (!carer) return null;
  return { svc, carerId: carer.id };
}

export async function GET() {
  const ctx = await getSvc();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data } = await ctx.svc.from("tasks")
    .select("*, clients(full_name)").eq("carer_id", ctx.carerId)
    .order("created_at", { ascending: false }).limit(30);
  return NextResponse.json(data ?? []);
}

export async function PUT(req: NextRequest) {
  const ctx = await getSvc();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  if (body.action === "complete") {
    const { error } = await ctx.svc.from("tasks")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", body.id).eq("carer_id", ctx.carerId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
