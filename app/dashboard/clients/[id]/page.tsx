import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Heart, Calendar, MapPin, FileText, MessageSquare, Shield, CalendarClock, CheckCircle2, Clock, Pill, ClipboardList, Stethoscope } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { DeleteButton } from "@/components/shared/delete-button";
import { PhotoUpload } from "@/components/shared/photo-upload";
import { CareNoteForm } from "@/components/shared/care-note-form";
import { StatusBadge } from "@/components/shared/status-badge";
import { TabNav } from "@/components/shared/tab-nav";
import { TaskForm } from "./task-form";
import { MedicationForm } from "./medication-form";
import { CarePlanForm } from "./care-plan-form";
import { AssessmentForm } from "./assessment-form";
import { MedAdminButton } from "@/components/shared/med-admin-button";
import type { Tables } from "@/lib/database.types";

type ClientRow = Tables<"clients">;
type CarerRow = Tables<"carers">;
type CareNoteRow = Tables<"care_notes">;
type DocumentRow = Tables<"documents">;
type ShiftRow = Tables<"shifts">;
type IncidentRow = Tables<"incidents">;
type TaskRow = Tables<"tasks">;
type MedicationRow = Tables<"medications">;
type CarePlanRow = Tables<"care_plans">;
type AssessmentRow = Tables<"assessments">;

const CLIENT_TABS = [
  { id: "overview", label: "Overview" },
  { id: "tasks", label: "Tasks" },
  { id: "medications", label: "Medications" },
  { id: "care-plans", label: "Care Plans" },
  { id: "assessments", label: "Assessments" },
  { id: "notes", label: "Care Notes" },
  { id: "documents", label: "Documents" },
  { id: "shifts", label: "Shifts" },
];

const moodEmoji: Record<string, string> = { happy: "😊", neutral: "😐", concerned: "😟", distressed: "😢" };
const priorityColors: Record<string, string> = { low: "bg-blue-100 text-blue-700", medium: "bg-amber-100 text-amber-700", high: "bg-red-100 text-red-700" };
const medStatusColors: Record<string, string> = { active: "bg-green-100 text-green-700", paused: "bg-amber-100 text-amber-700", stopped: "bg-red-100 text-red-700" };
const assessmentCategoryColors: Record<string, string> = { initial: "bg-blue-100 text-blue-700", review: "bg-teal-100 text-teal-700", risk: "bg-red-100 text-red-700", care: "bg-green-100 text-green-700" };

export default async function ClientDetailPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab } = await searchParams;
  const activeTab = tab || "overview";
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  const orgId = admin?.org_id ?? "";

  const { data: client } = await supabase.from("clients").select("*").eq("org_id", orgId).eq("id", id).single().returns<ClientRow>();
  if (!client) return (
    <div className="space-y-6">
      <Link href="/dashboard/clients"><Button variant="ghost" size="sm" className="rounded-xl gap-2"><ArrowLeft className="h-4 w-4" />Back to Clients</Button></Link>
      <Card className="rounded-2xl shadow-card border-0"><CardContent className="flex flex-col items-center py-12"><Heart className="h-12 w-12 text-muted-foreground/40" /><h3 className="mt-4 text-lg font-medium">Client Not Found</h3></CardContent></Card>
    </div>
  );

  const { data: notes } = await supabase.from("care_notes").select("*").eq("org_id", orgId).eq("client_id", id).order("created_at", { ascending: false }).limit(30).returns<CareNoteRow[]>();
  const { data: carers } = await supabase.from("carers").select("id, full_name").eq("org_id", orgId).returns<Pick<CarerRow, "id" | "full_name">[]>();
  const { data: documents } = await supabase.from("documents").select("*, document_types(name)").eq("org_id", orgId).eq("owner_id", id).is("deleted_at", null).order("expiry_date", { ascending: true }).returns<(DocumentRow & { document_types: { name: string } | null })[]>();
  const { data: shifts } = await supabase.from("shifts").select("*").eq("org_id", orgId).eq("client_id", id).order("start_time", { ascending: false }).limit(20).returns<ShiftRow[]>();
  const { data: incidents } = await supabase.from("incidents").select("*").eq("org_id", orgId).eq("client_id", id).order("reported_at", { ascending: false }).returns<IncidentRow[]>();
  const { data: tasks } = await supabase.from("tasks").select("*").eq("org_id", orgId).eq("client_id", id).order("created_at", { ascending: false }).returns<TaskRow[]>();
  const { data: medications } = await supabase.from("medications").select("*").eq("org_id", orgId).eq("client_id", id).order("start_date", { ascending: false }).returns<MedicationRow[]>();
  const { data: carePlans } = await supabase.from("care_plans").select("*").eq("org_id", orgId).eq("client_id", id).order("created_at", { ascending: false }).returns<CarePlanRow[]>();
  const { data: assessments } = await supabase.from("assessments").select("*").eq("org_id", orgId).eq("client_id", id).order("assessed_at", { ascending: false }).returns<AssessmentRow[]>();

  const openIncidents = incidents?.filter(i => i.status === "open").length ?? 0;
  const riskLevel = openIncidents > 2 ? "high" : openIncidents > 0 ? "medium" : "low";
  const riskColors: Record<string, string> = { low: "bg-green-100 text-green-700", medium: "bg-amber-100 text-amber-700", high: "bg-red-100 text-red-700" };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <Link href="/dashboard/clients"><Button variant="ghost" size="sm" className="rounded-xl gap-2"><ArrowLeft className="h-4 w-4" />Back to Clients</Button></Link>
        <DeleteButton apiUrl={`/api/clients/${id}`} entityName="client" redirectTo="/dashboard/clients" />
      </div>

      <Card className="rounded-2xl shadow-card border-0">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-start gap-4">
              <PhotoUpload clientId={id} currentPhotoUrl={client.photo_url} clientName={client.full_name} />
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{client.full_name}</h1>
                <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
                  {client.dob && <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{new Date(client.dob).toLocaleDateString()}</span>}
                  {client.address && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{client.address}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={`rounded-lg px-3 py-1 ${riskColors[riskLevel]}`}>Risk: {riskLevel.toUpperCase()}</Badge>
              <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 rounded-lg px-3 py-1">Active</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <TabNav tabs={CLIENT_TABS} defaultTab="overview" />
      </div>

      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-4">
            <Card className="rounded-2xl shadow-card border-0"><CardContent className="flex items-center gap-3 p-5"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted"><MessageSquare className="h-5 w-5 text-muted-foreground" /></div><div><p className="text-2xl font-bold">{notes?.length ?? 0}</p><p className="text-xs text-muted-foreground">Care Notes</p></div></CardContent></Card>
            <Card className="rounded-2xl shadow-card border-0"><CardContent className="flex items-center gap-3 p-5"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted"><Pill className="h-5 w-5 text-muted-foreground" /></div><div><p className="text-2xl font-bold">{medications?.length ?? 0}</p><p className="text-xs text-muted-foreground">Meds</p></div></CardContent></Card>
            <Card className="rounded-2xl shadow-card border-0"><CardContent className="flex items-center gap-3 p-5"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted"><CheckCircle2 className="h-5 w-5 text-muted-foreground" /></div><div><p className="text-2xl font-bold">{tasks?.filter(t => t.status === "completed").length ?? 0} / {tasks?.length ?? 0}</p><p className="text-xs text-muted-foreground">Tasks Done</p></div></CardContent></Card>
            <Card className="rounded-2xl shadow-card border-0"><CardContent className="flex items-center gap-3 p-5"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted"><Shield className="h-5 w-5 text-muted-foreground" /></div><div><p className="text-2xl font-bold">{openIncidents}</p><p className="text-xs text-muted-foreground">Open Incidents</p></div></CardContent></Card>
          </div>
        </div>
      )}

      {activeTab === "tasks" && (
        <div className="space-y-6">
          <TaskForm clientId={id} carers={carers?.map(c => ({ id: c.id, full_name: c.full_name })) ?? []} />
          <Card className="rounded-2xl shadow-card border-0">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Tasks</CardTitle></CardHeader>
            <CardContent>
              {(!tasks || tasks.length === 0) ? (
                <EmptyState icon={CheckCircle2} title="No tasks" description="Create a task using the form above." />
              ) : (
                <div className="space-y-2">
                  {tasks.map(t => (
                    <div key={t.id} className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3 text-sm">
                      <div className="flex items-center gap-3">
                        <span className={t.status === "completed" ? "line-through text-muted-foreground" : ""}>{t.title}</span>
                        <Badge className={`rounded-md text-[10px] ${priorityColors[t.priority] || ""}`}>{t.priority}</Badge>
                        <Badge variant="outline" className="rounded-md text-[10px] capitalize">{t.category}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        {t.due_date && <span className="text-xs text-muted-foreground">{new Date(t.due_date).toLocaleDateString()}</span>}
                        <StatusBadge status={t.status === "completed" ? "green" : t.status === "pending" ? "amber" : "green"} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "medications" && (
        <div className="space-y-6">
          <MedicationForm clientId={id} />
          <Card className="rounded-2xl shadow-card border-0">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">MAR Chart</CardTitle></CardHeader>
            <CardContent>
              {(!medications || medications.length === 0) ? (
                <EmptyState icon={Pill} title="No medications" description="Add a medication using the form above." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                        <th className="pb-2 pr-3">Drug</th><th className="pb-2 pr-3">Dosage</th><th className="pb-2 pr-3">Frequency</th><th className="pb-2 pr-3">Route</th><th className="pb-2 pr-3">Start</th><th className="pb-2 pr-3">End</th><th className="pb-2 pr-3">Status</th><th className="pb-2">Log</th>
                      </tr>
                    </thead>
                    <tbody>
                      {medications.map(m => (
                        <tr key={m.id} className="border-b last:border-0">
                          <td className="py-3 pr-3 font-medium">{m.drug_name}</td>
                          <td className="py-3 pr-3 text-muted-foreground">{m.dosage}</td>
                          <td className="py-3 pr-3 text-muted-foreground">{m.frequency}</td>
                          <td className="py-3 pr-3 text-muted-foreground capitalize">{m.route}</td>
                          <td className="py-3 pr-3 text-muted-foreground">{new Date(m.start_date).toLocaleDateString()}</td>
                          <td className="py-3 pr-3 text-muted-foreground">{m.end_date ? new Date(m.end_date).toLocaleDateString() : "Ongoing"}</td>
                          <td className="py-3"><Badge className={`rounded-md text-[10px] ${medStatusColors[m.status] || ""}`}>{m.status}</Badge></td>
                          <td className="py-3"><MedAdminButton medicationId={m.id} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "care-plans" && (
        <div className="space-y-6">
          <CarePlanForm clientId={id} />
          <Card className="rounded-2xl shadow-card border-0">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Care Plans</CardTitle></CardHeader>
            <CardContent>
              {(!carePlans || carePlans.length === 0) ? (
                <EmptyState icon={ClipboardList} title="No care plans" description="Create a care plan using the form above." />
              ) : (
                <div className="space-y-4">
                  {carePlans.map(cp => (
                    <div key={cp.id} className="rounded-xl border bg-card p-5">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium">{cp.title}</h3>
                        <Badge className={`rounded-md text-[10px] ${cp.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>{cp.status}</Badge>
                      </div>
                      {cp.goals && <p className="text-sm text-muted-foreground mb-2"><span className="font-medium text-foreground">Goals:</span> {cp.goals}</p>}
                      {cp.interventions && <p className="text-sm text-muted-foreground mb-2"><span className="font-medium text-foreground">Interventions:</span> {cp.interventions}</p>}
                      {cp.notes && <p className="text-sm text-muted-foreground mb-2"><span className="font-medium text-foreground">Notes:</span> {cp.notes}</p>}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                        {cp.review_date && <span><Clock className="inline h-3 w-3 mr-1" />Review: {new Date(cp.review_date).toLocaleDateString()}</span>}
                        <span>Created: {new Date(cp.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "assessments" && (
        <div className="space-y-6">
          <AssessmentForm clientId={id} />
          <Card className="rounded-2xl shadow-card border-0">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Assessments</CardTitle></CardHeader>
            <CardContent>
              {(!assessments || assessments.length === 0) ? (
                <EmptyState icon={Stethoscope} title="No assessments" description="Complete an assessment using the form above." />
              ) : (
                <div className="space-y-4">
                  {assessments.map(a => (
                    <div key={a.id} className="rounded-xl border bg-card p-5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{a.title}</h3>
                          <Badge className={`rounded-md text-[10px] ${assessmentCategoryColors[a.category] || ""}`}>{a.category}</Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">{new Date(a.assessed_at).toLocaleDateString()}</span>
                      </div>
                      {a.scores && Object.keys(a.scores as Record<string, unknown>).length > 0 && (
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          {Object.entries(a.scores as Record<string, number>).map(([k, v]) => (
                            <div key={k} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-1.5 text-xs">
                              <span className="capitalize">{k.replace("_", " ")}</span>
                              <span className="font-medium">{v}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {a.notes && <p className="text-sm text-muted-foreground mt-2">{a.notes}</p>}
                      {a.next_review_date && <p className="text-xs text-muted-foreground mt-2"><Clock className="inline h-3 w-3 mr-1" />Next review: {new Date(a.next_review_date).toLocaleDateString()}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "notes" && (
        <Card className="rounded-2xl shadow-card border-0">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Care Notes</CardTitle></CardHeader>
          <CardContent>
            {(!notes || notes.length === 0) ? <EmptyState icon={MessageSquare} title="No care notes" description="Care notes will appear here once recorded." /> : (
              <div className="space-y-3">
                {notes.map(n => (
                  <div key={n.id} className="rounded-xl border bg-card p-4"><p className="text-sm">{n.note_text}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="rounded-md text-[10px] capitalize">{n.note_type.replace("_", " ")}</Badge>
                      {n.mood && <span>{moodEmoji[n.mood] || ""} {n.mood}</span>}
                      {n.fluids && <span>Fluids: {n.fluids}</span>}{n.nutrition && <span>Nutrition: {n.nutrition}</span>}
                      <span className="ml-auto">{new Date(n.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <CareNoteForm clientId={id} carers={carers?.map(c => ({ id: c.id, full_name: c.full_name })) ?? []} />
          </CardContent>
        </Card>
      )}

      {activeTab === "documents" && (
        <Card className="rounded-2xl shadow-card border-0">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Documents</CardTitle></CardHeader>
          <CardContent>
            {(!documents || documents.length === 0) ? <EmptyState icon={FileText} title="No documents" description="No compliance documents for this client." /> : (
              <div className="space-y-2">{documents.map(d => (
                <div key={d.id} className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3 text-sm"><div><span className="font-medium">{d.document_types?.name || "Custom"}</span>{d.expiry_date && <p className="text-xs text-muted-foreground">Expires: {new Date(d.expiry_date).toLocaleDateString()}</p>}</div><StatusBadge status={d.status ?? "green"} /></div>
              ))}</div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "shifts" && (
        <Card className="rounded-2xl shadow-card border-0">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Shifts</CardTitle></CardHeader>
          <CardContent>
            {(!shifts || shifts.length === 0) ? <EmptyState icon={CalendarClock} title="No shifts" description="No shifts recorded for this client." /> : (
              <div className="space-y-2">{shifts.map(s => (
                <div key={s.id} className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3 text-sm"><div><span className="font-medium">{new Date(s.start_time).toLocaleDateString()}</span><span className="text-muted-foreground ml-2">{new Date(s.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - {new Date(s.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div><StatusBadge status={s.status} /></div>
              ))}</div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
