import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import type { Tables } from "@/lib/database.types";
import AnalyticsContent from "./analytics-content";

type Carer = Tables<"carers"> & { shifts?: Tables<"shifts">[]; tasks?: Tables<"tasks">[]; notes?: Tables<"care_notes">[]; handovers?: Tables<"handover_notes">[] };
type Shift = Tables<"shifts"> & { carer?: Pick<Carer, "full_name"> | null; client?: Pick<Tables<"clients">, "full_name"> | null };
type Client = Tables<"clients">;
type Incident = Tables<"incidents">;

export default async function AnalyticsPage() {
  const admin = await getCurrentAdmin();
  if (!admin) return <div className="p-8 text-center text-muted-foreground">Admin access required.</div>;
  const adminClient = createAdminClient();
  const orgId = admin.org_id ?? "";

  const [carers, clients, shifts, tasks, incidents, documents, notes, handovers, absences, locations] = await Promise.all([
    adminClient.from("carers").select("*").eq("org_id", orgId).order("full_name").returns<Carer[]>(),
    adminClient.from("clients").select("*").eq("org_id", orgId).order("full_name").returns<Client[]>(),
    adminClient.from("shifts").select("*, carer:carers(full_name), client:clients(full_name)").eq("org_id", orgId).order("start_time", { ascending: false }).returns<Shift[]>(),
    adminClient.from("tasks").select("*").eq("org_id", orgId).order("created_at", { ascending: false }).returns<Tables<"tasks">[]>(),
    adminClient.from("incidents").select("*").eq("org_id", orgId).order("reported_at", { ascending: false }).returns<Incident[]>(),
    adminClient.from("documents").select("status, expiry_date, owner_id, owner_type").eq("org_id", orgId).is("deleted_at", null).returns<Tables<"documents">[]>(),
    adminClient.from("care_notes").select("id, carer_id, mood, created_at").eq("org_id", orgId).order("created_at", { ascending: false }).limit(200).returns<Tables<"care_notes">[]>(),
    adminClient.from("handover_notes").select("id, from_carer_id, to_carer_id, is_read").eq("org_id", orgId).returns<Tables<"handover_notes">[]>(),
    adminClient.from("absences").select("*").eq("org_id", orgId).returns<Tables<"absences">[]>(),
    adminClient.from("locations").select("*").eq("org_id", orgId).returns<Tables<"locations">[]>(),
  ]);

  const carerList = carers.data ?? [];
  const clientList = clients.data ?? [];
  const shiftList = shifts.data ?? [];
  const taskList = tasks.data ?? [];
  const incidentList = incidents.data ?? [];
  const documentList = documents.data ?? [];
  const noteList = notes.data ?? [];
  const handoverList = handovers.data ?? [];
  const absenceList = absences.data ?? [];
  const locationList = locations.data ?? [];

  return (
    <AnalyticsContent
      carers={carerList}
      clients={clientList}
      shifts={shiftList}
      tasks={taskList}
      incidents={incidentList}
      documents={documentList}
      notes={noteList}
      handovers={handoverList}
      absences={absenceList}
      locations={locationList}
    />
  );
}
