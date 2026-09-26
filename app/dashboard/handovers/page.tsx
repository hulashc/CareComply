import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { HandoverActions } from "./handover-actions";

export default async function HandoversPage() {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  const orgId = admin?.org_id ?? "";

  const { data: handovers } = await supabase
    .from("handover_notes")
    .select("*, clients(full_name)")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  const { data: clients } = await supabase
    .from("clients")
    .select("id, full_name")
    .eq("org_id", orgId);

  const { data: carers } = await supabase
    .from("carers")
    .select("id, full_name")
    .eq("org_id", orgId);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Handover Notes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {handovers?.length ?? 0} note{(handovers?.length ?? 1) !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <HandoverActions
        initialHandovers={handovers ?? []}
        initialClients={clients ?? []}
        initialCarers={carers ?? []}
      />
    </div>
  );
}
