import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, CheckCircle2, AlertTriangle, CalendarClock, Users, Heart, Clock, Send, AlertOctagon, Activity, ChevronRight, XCircle, AlertCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { SeedDemoButton } from "@/components/shared/seed-demo-button";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function daysFromNow(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

async function fetchData(orgId: string) {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const today = new Date().toISOString().split("T")[0];
  const errors: string[] = [];

  const push = (label: string, err: any) => {
    if (err) errors.push(`${label}: ${err.message || err}`);
  };

  const { data: carers, error: e1 } = await supabase.from("carers").select("id, full_name, role").eq("org_id", orgId);
  push("carers", e1);

  const { data: documents, error: e2 } = await supabase.from("documents").select("*").eq("org_id", orgId).is("deleted_at", null).order("expiry_date", { ascending: true });
  push("documents", e2);

  const { data: docTypes, error: e3 } = await supabase.from("document_types").select("id, name");
  push("doc_types", e3);

  const { count: clientCount, error: e4 } = await supabase.from("clients").select("*", { count: "exact", head: true }).eq("org_id", orgId);
  push("clients", e4);

  const { count: shiftCount, error: e5 } = await supabase.from("shifts").select("*", { count: "exact", head: true }).eq("org_id", orgId).gte("start_time", today);
  push("shifts_count", e5);

  const { count: openIncidentsCount, error: e6 } = await supabase.from("incidents").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "open");
  push("incidents_count", e6);

  const { data: rawShifts, error: e7 } = await supabase.from("shifts").select("*").eq("org_id", orgId).gte("start_time", today).order("start_time", { ascending: true }).limit(5);
  push("upcoming_shifts", e7);

  const { data: rawIncidents, error: e8 } = await supabase.from("incidents").select("*").eq("org_id", orgId).eq("status", "open").order("reported_at", { ascending: false }).limit(3);
  push("open_incidents", e8);

  const { data: rawAudit, error: e9 } = await supabase.from("audit_logs").select("*").eq("org_id", orgId).order("created_at", { ascending: false }).limit(10);
  push("audit_logs", e9);

  // Fetch related names separately
  const clientIds = [...new Set([...(rawShifts ?? []).map((s: any) => s.client_id), ...(rawIncidents ?? []).map((i: any) => i.client_id)])];
  const carerIds = [...new Set([...(rawShifts ?? []).map((s: any) => s.carer_id)])];
  const adminIds = [...new Set([...(rawAudit ?? []).map((a: any) => a.actor_id).filter(Boolean)])];

  const { data: clientNames } = clientIds.length > 0 ? await supabase.from("clients").select("id, full_name").in("id", clientIds) : { data: [] };
  const { data: carerNames } = carerIds.length > 0 ? await supabase.from("carers").select("id, full_name").in("id", carerIds) : { data: [] };
  const { data: adminNames } = adminIds.length > 0 ? await supabase.from("admins").select("id, full_name").in("id", adminIds) : { data: [] };

  const clientMap = new Map((clientNames ?? []).map((c: any) => [c.id, c]));
  const carerNameMap = new Map((carerNames ?? []).map((c: any) => [c.id, c]));
  const adminMap = new Map((adminNames ?? []).map((a: any) => [a.id, a]));

  const upcomingShifts = (rawShifts ?? []).map((s: any) => ({ ...s, clients: clientMap.get(s.client_id) ?? null, carers: carerNameMap.get(s.carer_id) ?? null }));
  const openIncidentsList = (rawIncidents ?? []).map((i: any) => ({ ...i, clients: clientMap.get(i.client_id) ?? null }));
  const auditLogs = (rawAudit ?? []).map((a: any) => ({ ...a, admins: adminMap.get(a.actor_id) ?? null }));

  return {
    carers: carers ?? [],
    documents: documents ?? [],
    docTypes: docTypes ?? [],
    clientCount: clientCount ?? 0,
    shiftCount: shiftCount ?? 0,
    openIncidentsCount: openIncidentsCount ?? 0,
    upcomingShifts: upcomingShifts ?? [],
    openIncidentsList: openIncidentsList ?? [],
    auditLogs: auditLogs ?? [],
    errors,
  };
}

export default async function DashboardPage() {
  const admin = await getCurrentAdmin();
  const orgId = admin?.org_id ?? "";

  const {
    carers, documents, docTypes, clientCount, shiftCount,
    openIncidentsCount, upcomingShifts, openIncidentsList, auditLogs, errors,
  } = await fetchData(orgId);

  const carerMap = new Map(carers.map((c: any) => [c.id, c]));
  const docTypeMap = new Map(docTypes.map((dt: any) => [dt.id, dt.name]));
  const expiredDocs = documents.filter((d: any) => d.status === "red");
  const expiringDocs = documents.filter((d: any) => d.status === "amber");
  const compliantCount = documents.filter((d: any) => d.status === "green").length;

  const stats = [
    { label: "Carers", value: carers.length, icon: Users, href: "/dashboard/carers", color: "text-primary" },
    { label: "Clients", value: clientCount, icon: Heart, href: "/dashboard/clients", color: "text-secondary" },
    { label: "Shifts Today", value: shiftCount, icon: CalendarClock, href: "/dashboard/shifts", color: "text-gold" },
    { label: "Open Incidents", value: openIncidentsCount, icon: AlertOctagon, href: "/dashboard/incidents", color: openIncidentsCount > 0 ? "text-destructive" : "text-success", danger: openIncidentsCount > 0 },
  ];

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{getGreeting()}, {admin?.full_name?.split(" ")[0] || "there"}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Here&apos;s what&apos;s happening today.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/shifts"><Button size="sm" variant="outline" className="rounded-lg gap-1.5 border-border/60 text-xs"><CalendarClock className="h-3.5 w-3.5" />Schedule Shift</Button></Link>
          <Link href="/dashboard/incidents"><Button size="sm" variant="outline" className="rounded-lg gap-1.5 border-red-200 text-destructive hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30 text-xs"><AlertOctagon className="h-3.5 w-3.5" />Report Incident</Button></Link>
          <Link href="/dashboard/invite-carer"><Button size="sm" className="rounded-lg gap-1.5 gradient-indigo text-white hover:opacity-90 shadow-glow-primary text-xs"><Send className="h-3.5 w-3.5" />Invite Carer</Button></Link>
        </div>
      </div>

      {/* Errors banner */}
      {errors.length > 0 && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <p className="font-semibold mb-1">Data fetch errors:</p>
          {errors.map((e, i) => <p key={i} className="text-xs">&bull; {e}</p>)}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main content */}
        <div className="lg:col-span-3 space-y-4">

          {/* Compliance Alerts */}
          {(expiredDocs.length > 0 || expiringDocs.length > 0) && (
            <div className="space-y-2.5">
              {expiredDocs.length > 0 && (
                <Card className="rounded-lg border-red-300 dark:border-red-800 shadow-sm overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-red-50 to-red-50/50 dark:from-red-950/30 dark:to-red-950/10 border-b border-red-200/50 dark:border-red-800/50 py-2.5 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-destructive shrink-0" />
                        <CardTitle className="text-sm font-semibold text-destructive">Expired Documents</CardTitle>
                        <span className="text-xs text-destructive/70 font-medium">({expiredDocs.length})</span>
                      </div>
                      <Link href="/dashboard/compliance">
                        <Button variant="ghost" size="sm" className="rounded-lg text-xs gap-0.5 h-7">View <ChevronRight className="h-3 w-3" /></Button>
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-red-100 dark:divide-red-900/30">
                      {expiredDocs.map((doc: any) => {
                        const carer = carerMap.get(doc.owner_id);
                        const daysOverdue = -daysFromNow(doc.expiry_date!);
                        return (
                          <Link key={doc.id} href={`/dashboard/carers/${doc.owner_id}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-colors">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{carer?.full_name || "Unknown Carer"}</p>
                                <p className="text-xs text-muted-foreground truncate">{docTypeMap.get(doc.document_type_id ?? "") || "Custom Upload"}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs font-semibold text-destructive">{daysOverdue}d overdue</span>
                              <StatusBadge status="expired" />
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {expiringDocs.length > 0 && (
                <Card className="rounded-lg border-amber-300 dark:border-amber-800 shadow-sm overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-amber-50 to-amber-50/50 dark:from-amber-950/30 dark:to-amber-950/10 border-b border-amber-200/50 dark:border-amber-800/50 py-2.5 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        <CardTitle className="text-sm font-semibold text-amber-700 dark:text-amber-300">Expiring Soon</CardTitle>
                        <span className="text-xs text-amber-600/70 font-medium">({expiringDocs.length})</span>
                      </div>
                      <Link href="/dashboard/compliance">
                        <Button variant="ghost" size="sm" className="rounded-lg text-xs gap-0.5 h-7">View <ChevronRight className="h-3 w-3" /></Button>
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-amber-100 dark:divide-amber-900/30">
                      {expiringDocs.map((doc: any) => {
                        const carer = carerMap.get(doc.owner_id);
                        const daysLeft = daysFromNow(doc.expiry_date!);
                        return (
                          <Link key={doc.id} href={`/dashboard/carers/${doc.owner_id}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 transition-colors">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{carer?.full_name || "Unknown Carer"}</p>
                                <p className="text-xs text-muted-foreground truncate">{docTypeMap.get(doc.document_type_id ?? "") || "Custom Upload"}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">{daysLeft}d remaining</span>
                              <StatusBadge status="expiring_soon" />
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {compliantCount > 0 && (
                <div className="flex items-center gap-1.5 px-0.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  <p className="text-xs text-muted-foreground">{compliantCount} compliant — no action needed</p>
                </div>
              )}
            </div>
          )}

          {(!documents || documents.length === 0) && (
            <Card className="rounded-lg border-border/40 shadow-sm">
              <CardContent className="py-8">
                <EmptyState icon={FileText} title="No documents yet" description="Upload your first compliance document." action={<Link href="/dashboard/add-document"><Button className="rounded-lg gradient-indigo text-white hover:opacity-90">Add Document</Button></Link>} />
              </CardContent>
            </Card>
          )}

          {/* Shifts + Incidents */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {upcomingShifts.length > 0 ? (
              <Card className="rounded-lg border-border/40 shadow-sm overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between py-2.5 px-4 border-b border-border/30">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm font-semibold">Upcoming Shifts</CardTitle>
                  </div>
                  <Link href="/dashboard/shifts"><Button variant="ghost" size="sm" className="rounded-lg text-xs h-7">View</Button></Link>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border/20">
                    {upcomingShifts.map((shift: any) => (
                      <div key={shift.id} className="flex items-center justify-between px-4 py-2 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <Clock className="h-3 w-3 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{shift.clients?.full_name ?? "Unknown"}</p>
                            <p className="text-xs text-muted-foreground truncate">{shift.carers?.full_name ?? "Unassigned"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs text-muted-foreground">{new Date(shift.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          <StatusBadge status={shift.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="rounded-lg border-border/40 shadow-sm">
                <CardContent className="py-6 text-center">
                  <CalendarClock className="h-5 w-5 text-muted-foreground/40 mx-auto mb-1.5" />
                  <p className="text-sm text-muted-foreground">No upcoming shifts</p>
                </CardContent>
              </Card>
            )}

            {openIncidentsList.length > 0 ? (
              <Card className="rounded-lg border-red-200/50 dark:border-red-900/50 shadow-sm overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between py-2.5 px-4 border-b border-red-200/30 dark:border-red-900/30">
                  <div className="flex items-center gap-2">
                    <div className="flex h-2 w-2 rounded-full bg-destructive animate-pulse-soft" />
                    <CardTitle className="text-sm font-semibold">Open Incidents</CardTitle>
                    <span className="text-xs text-destructive font-medium">({openIncidentsList.length})</span>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-red-200/30 dark:divide-red-900/30">
                    {openIncidentsList.map((incident: any) => (
                      <div key={incident.id} className="flex items-center justify-between px-4 py-2 hover:bg-red-50/30 dark:hover:bg-red-950/10 transition-colors">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{incident.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{incident.clients?.full_name ?? "Unknown"} &middot; {incident.severity.toUpperCase()}</p>
                        </div>
                        <StatusBadge status={incident.category} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="rounded-lg border-border/40 shadow-sm">
                <CardContent className="py-6 text-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400/60 mx-auto mb-1.5" />
                  <p className="text-sm text-muted-foreground">No open incidents</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Recent Activity */}
          <Card className="rounded-lg border-border/40 shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between py-2.5 px-4 border-b border-border/30">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-secondary" />
                <CardTitle className="text-sm font-semibold">Recent Activity</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {auditLogs.length > 0 ? (
                <div className="divide-y divide-border/20">
                  {auditLogs.map((entry: any) => (
                    <div key={entry.id} className="flex items-center gap-2.5 px-4 py-2 hover:bg-muted/30 transition-colors">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-secondary/10">
                        <Clock className="h-3 w-3 text-secondary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs truncate"><span className="font-medium">{entry.admins?.full_name ?? "System"}</span><span className="text-muted-foreground"> {entry.action.replace(/_/g, " ")}</span></p>
                        {entry.details && <p className="text-xs text-muted-foreground truncate">{entry.details}</p>}
                      </div>
                      <span className="text-[11px] text-muted-foreground shrink-0">{new Date(entry.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center">
                  <Activity className="h-5 w-5 text-muted-foreground/40 mx-auto mb-1.5" />
                  <p className="text-sm text-muted-foreground">No recent activity</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Stats summary */}
          <Card className="rounded-lg border-border/40 shadow-sm">
            <CardHeader className="py-2.5 px-4 border-b border-border/30">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Overview</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/20">
                {stats.map((stat) => (
                  <Link key={stat.label} href={stat.href} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <stat.icon className={`h-4 w-4 ${stat.color}`} />
                      <span className="text-sm">{stat.label}</span>
                    </div>
                    <span className={`text-sm font-semibold ${stat.danger ? "text-destructive" : ""}`}>{stat.value}</span>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Mini compliance summary */}
          {documents.length > 0 && (
            <Card className="rounded-lg border-border/40 shadow-sm">
              <CardHeader className="py-2.5 px-4 border-b border-border/30">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Compliance</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/20">
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      <span className="text-sm text-emerald-700 dark:text-emerald-400">Compliant</span>
                    </div>
                    <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{compliantCount}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                      <span className="text-sm text-amber-700 dark:text-amber-400">Expiring</span>
                    </div>
                    <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">{expiringDocs.length}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
                      <span className="text-sm text-destructive">Expired</span>
                    </div>
                    <span className="text-sm font-semibold text-destructive">{expiredDocs.length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Seed Demo Data */}
          <SeedDemoButton hasData={carers.length > 0} />
        </div>
      </div>
    </div>
  );
}
