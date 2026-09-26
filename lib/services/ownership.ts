import { SupabaseClient } from "@supabase/supabase-js";

type TableMap = {
  clients: "org_id";
  carers: "org_id";
  medications: "org_id";
};

export async function verifyOrgOwnership<T extends keyof TableMap>(
  supabase: SupabaseClient,
  table: T,
  recordId: string,
  orgId: string,
): Promise<boolean> {
  if (!recordId || !orgId) return false;
  const { data } = await supabase
    .from(table)
    .select("id")
    .eq("id", recordId)
    .eq("org_id", orgId)
    .maybeSingle();
  return !!data;
}
