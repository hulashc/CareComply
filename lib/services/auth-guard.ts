import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/database.types";

type AdminRow = Tables<"admins">;

export async function getCurrentAdmin(): Promise<AdminRow | null> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;

  const adminClient = createAdminClient();
  const { data: admin, error } = await adminClient
    .from("admins")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) return null;
  return admin;
}

export async function requireAdmin(): Promise<AdminRow> {
  const admin = await getCurrentAdmin();
  if (!admin) throw new Error("Admin access required");
  return admin;
}
