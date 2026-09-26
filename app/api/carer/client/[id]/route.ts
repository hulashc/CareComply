import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";

async function getCtx() {
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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  // Check carer is assigned to this client
  const { data: shift } = await ctx.svc.from("shifts")
    .select("id").eq("carer_id", ctx.carerId).eq("client_id", id).limit(1);
  if (!shift || shift.length === 0) {
    return NextResponse.json({ error: "Not assigned to this client" }, { status: 403 });
  }

  const [cl, meds, plans, tsks] = await Promise.all([
    ctx.svc.from("clients").select("*").eq("id", id).single(),
    ctx.svc.from("medications").select("*").eq("client_id", id).eq("status", "active"),
    ctx.svc.from("care_plans").select("*").eq("client_id", id).eq("status", "active"),
    ctx.svc.from("tasks").select("*").eq("client_id", id).eq("status", "pending"),
  ]);

  if (cl.error) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  return NextResponse.json({
    client: cl.data,
    medications: meds.data ?? [],
    carePlans: plans.data ?? [],
    tasks: tsks.data ?? [],
  });
}
