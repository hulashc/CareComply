import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, AlertCircle, Shield, Clock, CheckCircle2 } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { ResolveIncident } from "@/components/shared/resolve-incident";
import { DeleteButton } from "@/components/shared/delete-button";
import { CsvExport } from "@/components/shared/csv-export";
import { StatusFilter } from "@/components/shared/status-filter";
import { Button } from "@/components/ui/button";
import IncidentForm from "./incident-form";
import { Pagination } from "@/components/shared/pagination";
import type { Tables } from "@/lib/database.types";

type IncidentRow = Tables<"incidents">;
type ClientRow = Tables<"clients">;

const SEVERITY_OPTIONS = [
  { value: "all", label: "All" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
];

const severityColors: Record<string, string> = {
  low: "bg-blue-100 text-blue-700 border-blue-300",
  medium: "bg-amber-100 text-amber-700 border-amber-300",
  high: "bg-red-100 text-red-700 border-red-300",
  critical: "bg-red-200 text-red-800 border-red-400",
};

const categoryColors: Record<string, string> = {
  fall: "bg-orange-100 text-orange-700 border-orange-300",
  medication_error: "bg-red-100 text-red-700 border-red-300",
  safeguarding: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-300",
  behaviour: "bg-yellow-100 text-yellow-700 border-yellow-300",
  missing_person: "bg-red-100 text-red-700 border-red-300",
  other: "bg-gray-100 text-gray-700 border-gray-300",
};

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: Promise<{ severity?: string; inc_status?: string; page?: string }>;
}) {
  const { severity, inc_status, page: pageStr } = await searchParams;
  const pageSize = 25;
  const page = Math.max(1, parseInt(pageStr ?? "1") || 1);
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  const orgId = admin?.org_id ?? "";

  let countQuery = supabase
    .from("incidents")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);

  let dataQuery = supabase
    .from("incidents")
    .select("*")
    .eq("org_id", orgId)
    .order("reported_at", { ascending: false });

  if (severity && severity !== "all") { countQuery = countQuery.eq("severity", severity); dataQuery = dataQuery.eq("severity", severity); }
  if (inc_status && inc_status !== "all") { countQuery = countQuery.eq("status", inc_status); dataQuery = dataQuery.eq("status", inc_status); }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const [{ count }, { data: incidents }] = await Promise.all([
    countQuery,
    dataQuery.range(from, to).returns<IncidentRow[]>(),
  ]);

  const { data: clients } = await supabase
    .from("clients")
    .select("id, full_name")
    .eq("org_id", orgId)
    .returns<Pick<ClientRow, "id" | "full_name">[]>();

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Incidents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {incidents?.length ?? 0} incident{(incidents?.length ?? 1) !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <IncidentForm clients={clients ?? []} />
          <CsvExport
            data={(incidents ?? []).map(i => ({
              Title: i.title, Severity: i.severity, Category: i.category, Status: i.status,
              Client: clients?.find(c => c.id === i.client_id)?.full_name ?? "Unknown",
              Reported: new Date(i.reported_at).toLocaleDateString(),
            }))}
            filename="incidents"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <StatusFilter label="Severity" options={SEVERITY_OPTIONS} current={severity ?? "all"} paramName="severity" />
        <StatusFilter label="Status" options={STATUS_OPTIONS} current={inc_status ?? "all"} paramName="inc_status" />
      </div>

      {(!incidents || incidents.length === 0) ? (
        <Card className="rounded-xl border border-border/50 shadow-card">
          <CardContent className="py-12">
            <EmptyState icon={AlertTriangle} title="No incidents" description="No incidents match your filters." />
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-xl border border-border/50 shadow-card">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">All Incidents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {incidents.map((incident) => {
                const clientName = clients?.find((c) => c.id === incident.client_id)?.full_name ?? "Unknown";
                return (
                  <div key={incident.id} className="rounded-xl border bg-card p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className={`rounded-md text-[10px] ${severityColors[incident.severity] || ""}`}>
                            {incident.severity.toUpperCase()}
                          </Badge>
                          <Badge variant="outline" className={`rounded-md text-[10px] ${categoryColors[incident.category] || ""}`}>
                            {incident.category.replace("_", " ").toUpperCase()}
                          </Badge>
                          <Badge variant="outline" className={`rounded-md text-[10px] ${incident.status === "open" ? "bg-red-100 text-red-700 border-red-300" : "bg-green-100 text-green-700 border-green-300"}`}>
                            {incident.status.toUpperCase()}
                          </Badge>
                        </div>
                        <h3 className="font-medium">{incident.title}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{incident.description}</p>
                        {incident.action_taken && (
                          <p className="mt-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                            <span className="font-medium">Action taken:</span> {incident.action_taken}
                          </p>
                        )}
                        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Client: {clientName}</span>
                          <span><Clock className="inline h-3 w-3 mr-1" />{new Date(incident.reported_at).toLocaleDateString()}</span>
                          {incident.resolved_at && (
                            <span className="text-green-600"><CheckCircle2 className="inline h-3 w-3 mr-1" />Resolved: {new Date(incident.resolved_at).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {incident.status === "open" && <><ResolveIncident incidentId={incident.id} /> <DeleteButton apiUrl={`/api/incidents/${incident.id}`} entityName="incident" variant="ghost" size="icon" /></>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <Pagination total={count ?? 0} page={page} pageSize={pageSize} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
