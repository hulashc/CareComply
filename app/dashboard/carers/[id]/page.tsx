import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Users, Mail, Phone, Calendar, FileText, Clock, Heart } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/shared/status-badge";
import { ComplianceScore } from "@/components/shared/compliance-score";
import { EmptyState } from "@/components/shared/empty-state";
import { DeleteButton } from "@/components/shared/delete-button";
import { TabNav } from "@/components/shared/tab-nav";
import { CarerAbsencesTab } from "./carer-absences-tab";
import type { Tables } from "@/lib/database.types";

type CarerRow = Tables<"carers">;
type DocumentRow = Tables<"documents">;
type QualificationRow = Tables<"qualifications">;
type ShiftRow = Tables<"shifts">;

const CARER_TABS = [
  { id: "overview", label: "Overview" },
  { id: "documents", label: "Documents" },
  { id: "qualifications", label: "Qualifications" },
  { id: "shifts", label: "Shifts" },
  { id: "clients", label: "Clients" },
  { id: "absences", label: "Absences" },
];

export default async function CarerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const activeTab = tab || "overview";
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  const orgId = admin?.org_id ?? "";

  const { data: carer } = await supabase.from("carers").select("*").eq("id", id).single().returns<CarerRow>();
  if (!carer) {
    return (
      <div className="space-y-6">
        <Link href="/dashboard/carers"><Button variant="ghost" size="sm" className="rounded-xl gap-2"><ArrowLeft className="h-4 w-4" />Back to Carers</Button></Link>
        <Card className="rounded-2xl shadow-card border-0"><CardContent className="flex flex-col items-center py-12"><Users className="h-12 w-12 text-muted-foreground/40" /><h3 className="mt-4 text-lg font-medium">Carer Not Found</h3></CardContent></Card>
      </div>
    );
  }

  const { data: documents } = await supabase.from("documents").select("*, document_types(name)").eq("org_id", orgId).eq("owner_id", id).is("deleted_at", null).order("expiry_date", { ascending: true }).returns<(DocumentRow & { document_types: { name: string } | null })[]>();
  const { data: qualifications } = await supabase.from("qualifications").select("*").eq("org_id", orgId).eq("carer_id", id).order("expiry_date", { ascending: true }).returns<QualificationRow[]>();
  const { data: shifts } = await supabase.from("shifts").select("*, clients(full_name)").eq("shifts.org_id", orgId).eq("carer_id", id).order("start_time", { ascending: false }).limit(20).returns<(ShiftRow & { clients: { full_name: string } | null })[]>();

  const green = documents?.filter(d => d.status === "green").length ?? 0;
  const amber = documents?.filter(d => d.status === "amber").length ?? 0;
  const red = documents?.filter(d => d.status === "red").length ?? 0;

  const uniqueClientIds = new Set<string>();
  const uniqueClients: { id: string; full_name: string }[] = [];
  (shifts ?? []).forEach(s => {
    if (s.client_id && !uniqueClientIds.has(s.client_id) && s.clients?.full_name) {
      uniqueClientIds.add(s.client_id);
      uniqueClients.push({ id: s.client_id, full_name: s.clients.full_name });
    }
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <Link href="/dashboard/carers"><Button variant="ghost" size="sm" className="rounded-xl gap-2"><ArrowLeft className="h-4 w-4" />Back to Carers</Button></Link>
        <DeleteButton apiUrl={`/api/carers/${id}`} entityName="carer" redirectTo="/dashboard/carers" />
      </div>

      <Card className="rounded-2xl shadow-card border-0">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 shrink-0"><Users className="h-7 w-7 text-primary" /></div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{carer.full_name}</h1>
                <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
                  {carer.email && <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{carer.email}</span>}
                  {carer.phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{carer.phone}</span>}
                  {carer.start_date && <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{new Date(carer.start_date).toLocaleDateString()}</span>}
                </div>
              </div>
            </div>
            <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 rounded-lg px-3 py-1 capitalize">{carer.role?.replace("_", " ") ?? "Carer"}</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <TabNav tabs={CARER_TABS} defaultTab="overview" />
        <span className="text-xs text-muted-foreground px-3 py-1.5 rounded-lg bg-muted/50">{shifts?.length ?? 0} shifts</span>
      </div>

      {activeTab === "overview" && (
        <div className="space-y-6">
          <Card className="rounded-2xl shadow-card border-0">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Compliance</CardTitle></CardHeader>
            <CardContent><ComplianceScore green={green} amber={amber} red={red} /></CardContent>
          </Card>
          {carer.notes && (
            <Card className="rounded-2xl shadow-card border-0">
              <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Notes</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">{carer.notes}</p></CardContent>
            </Card>
          )}
          {qualifications && qualifications.length > 0 && (
            <Card className="rounded-2xl shadow-card border-0">
              <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recent Qualifications</CardTitle></CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  {qualifications.slice(0, 4).map(q => (
                    <div key={q.id} className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3 text-sm">
                      <span className="font-medium capitalize">{q.qualification_type.replace("_", " ")}</span>
                      <StatusBadge status={q.status ?? "valid"} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === "documents" && (
        <Card className="rounded-2xl shadow-card border-0">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Documents</CardTitle></CardHeader>
          <CardContent>
            {(!documents || documents.length === 0) ? (
              <EmptyState icon={FileText} title="No documents" description="No compliance documents recorded." action={<Link href="/dashboard/add-document"><Button variant="outline" className="rounded-xl">Add Document</Button></Link>} />
            ) : (
              <div className="space-y-2">
                {documents.map(d => (
                  <div key={d.id} className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3 text-sm">
                    <div><span className="font-medium">{d.document_types?.name || "Custom"}</span>{d.expiry_date && <p className="text-xs text-muted-foreground">Expires: {new Date(d.expiry_date).toLocaleDateString()}</p>}</div>
                    <div className="flex items-center gap-2"><StatusBadge status={d.status ?? "green"} /><DeleteButton apiUrl={`/api/documents/${d.id}`} entityName="document" variant="ghost" size="icon" /></div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "qualifications" && (
        <Card className="rounded-2xl shadow-card border-0">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Qualifications</CardTitle></CardHeader>
          <CardContent>
            {(!qualifications || qualifications.length === 0) ? (
              <EmptyState icon={FileText} title="No qualifications" description="No qualifications recorded." />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {qualifications.map(q => (
                  <div key={q.id} className="flex items-center justify-between rounded-xl border bg-muted/30 px-4 py-3">
                    <div><p className="text-sm font-medium capitalize">{q.qualification_type.replace("_", " ")}</p>{q.expiry_date && <p className="text-xs text-muted-foreground">Expires: {new Date(q.expiry_date).toLocaleDateString()}</p>}</div>
                    <StatusBadge status={q.status ?? "valid"} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "shifts" && (
        <Card className="rounded-2xl shadow-card border-0">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Shift History</CardTitle></CardHeader>
          <CardContent>
            {(!shifts || shifts.length === 0) ? (
              <EmptyState icon={Clock} title="No shifts" description="No shifts recorded for this carer." />
            ) : (
              <div className="space-y-2">
                {shifts.map(s => (
                  <div key={s.id} className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3 text-sm">
                    <div>
                      <span className="font-medium">{new Date(s.start_time).toLocaleDateString()}</span>
                      <span className="text-muted-foreground ml-2">
                        {new Date(s.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - {s.clients?.full_name ?? "Unknown"}
                      </span>
                    </div>
                    <StatusBadge status={s.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "clients" && (
        <Card className="rounded-2xl shadow-card border-0">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Assigned Clients</CardTitle></CardHeader>
          <CardContent>
            {uniqueClients.length === 0 ? (
              <EmptyState icon={Heart} title="No clients" description="This carer has no assigned clients." />
            ) : (
              <div className="grid gap-2">
                {uniqueClients.map(c => (
                  <Link key={c.id} href={`/dashboard/clients/${c.id}`}>
                    <div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3 text-sm hover:bg-muted transition-colors">
                      <span className="font-medium">{c.full_name}</span>
                      <Button variant="ghost" size="sm" className="h-7 rounded-lg text-xs">View</Button>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "absences" && <CarerAbsencesTab carerId={id} />}
    </div>
  );
}
