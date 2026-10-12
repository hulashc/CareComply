import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { NextResponse } from "next/server";

async function getCarerId(): Promise<string | null> {
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
  return carer?.id ?? null;
}

export async function GET() {
  const carerId = await getCarerId();
  if (!carerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const today = new Date().toISOString().split("T")[0];
  const { data: shifts } = await svc.from("shifts")
    .select("*, clients(full_name)")
    .eq("carer_id", carerId)
    .gte("start_time", today)
    .order("start_time", { ascending: true });

  return NextResponse.json(shifts ?? []);
}
