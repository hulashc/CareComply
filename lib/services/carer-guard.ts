import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";

type CarerRow = Tables<"carers">;

export async function getCurrentCarer(): Promise<CarerRow | null> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;

  const { data: carer, error } = await supabase
    .from("carers")
    .select("*")
    .eq("auth_id", userId)
    .single();

  if (error) return null;
  return carer;
}
