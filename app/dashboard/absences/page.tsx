import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { AbsenceActions } from "./absence-actions";

export default async function AbsencesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  const orgId = admin?.org_id ?? "";

  let query = supabase
    .from("absences")
    .select("*, carers(full_name)")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (status && status !== "all") query = query.eq("status", status);

  const { data: absences } = await query;
  const { data: carers } = await supabase
    .from("carers")
    .select("id, full_name")
    .eq("org_id", orgId);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Absence Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {absences?.length ?? 0} absence{(absences?.length ?? 1) !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <AbsenceActions
        key={status ?? "all"}
        initialAbsences={absences ?? []}
        initialCarers={carers ?? []}
        currentStatus={status ?? "all"}
      />
    </div>
  );
}
