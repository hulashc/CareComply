import { NextResponse } from "next/server";
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

export async function GET() {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const today = new Date().toISOString().split("T")[0];
  const { data } = await ctx.svc.from("shifts")
    .select("client_id, clients!inner(full_name)")
    .eq("carer_id", ctx.carerId)
    .gte("start_time", today)
    .order("start_time");
  const seen = new Set<string>();
  const unique: { id: string; full_name: string }[] = [];
  data?.forEach((s) => {
    const client = Array.isArray(s.clients) ? s.clients[0] : s.clients;
    if (!seen.has(s.client_id) && client?.full_name) {
      seen.add(s.client_id);
      unique.push({ id: s.client_id, full_name: client.full_name });
    }
  });
  return NextResponse.json(unique);
}
