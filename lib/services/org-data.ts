import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";

type AdminRow = Tables<"admins">;

export async function createOrgScopedClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let orgId = "";
  if (user?.id) {
    const { data: admin } = await supabase
      .from("admins")
      .select("org_id")
      .eq("id", user.id)
      .maybeSingle();
    if (admin?.org_id) orgId = admin.org_id;
  }

  return { supabase, orgId, admin: null as AdminRow | null };
}
