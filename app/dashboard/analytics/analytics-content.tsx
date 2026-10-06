"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, TrendingDown, Activity, BarChart3, Users, Heart, Clock,
  CheckCircle2, XCircle, AlertTriangle, FileText, MessageSquare, CalendarX,
  MapPin, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo } from "react";

const MapView = dynamic(() => import("./map-view"), { ssr: false, loading: () => <div className="h-[400px] rounded-xl bg-muted animate-pulse flex items-center justify-center text-sm text-muted-foreground">Loading map...</div> });

type Carer = { id: string; full_name: string | null; email: string | null; phone: string | null; role: string | null; status: string | null; auth_id: string | null; location_id: string | null };
type Client = { id: string; full_name: string | null; address: string | null; location_id: string | null };
type Shift = { id: string; carer_id: string | null; client_id: string | null; start_time: string; end_time: string; status: string | null; carer?: { full_name: string } | null; client?: { full_name: string } | null };
type Task = { id: string; carer_id: string | null; client_id: string | null; title: string | null; status: string | null };
type Incident = { id: string; severity: string; category: string; status: string; reported_at: string };
type Document = { status: string | null; expiry_date: string | null; owner_id: string | null; owner_type: string | null };
type CareNote = { id: string; carer_id: string | null; mood: string | null; created_at: string };
type HandoverNote = { id: string; from_carer_id: string | null; to_carer_id: string | null; is_read: boolean | null };
type Absence = { id: string; carer_id: string | null; absence_type: string | null; start_date: string; end_date: string };
type Location = { id: string; name: string | null; address: string | null; } & Record<string, unknown>;

type Props = {
  carers: Carer[]; clients: Client[]; shifts: Shift[]; tasks: Task[];
  incidents: Incident[]; documents: Document[]; notes: CareNote[];
  handovers: HandoverNote[]; absences: Absence[]; locations: Location[];
};

function cn(...classes: (string | false | undefined | null)[]) { return classes.filter(Boolean).join(" "); }

function StatCard({ label, value, sub, icon: Icon, trend, color }: { label: string; value: string; sub?: string; icon: React.ElementType; trend?: "up" | "down" | "neutral"; color?: string }) {
  return (
    <Card className="rounded-xl border border-border/50 shadow-card">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">{label}</span>
          <Icon className={`h-4 w-4 ${color || "text-primary"}`} />
        </div>
        <p className="text-3xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        {trend && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend === "up" ? "text-green-600" : trend === "down" ? "text-red-600" : "text-muted-foreground"}`}>
            {trend === "up" ? <ArrowUpRight className="h-3 w-3" /> : trend === "down" ? <ArrowDownRight className="h-3 w-3" /> : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BarChart({ data, colorMap, max }: { data: Record<string, number>; colorMap: Record<string, string>; max?: number }) {
  const maxVal = max ?? Math.max(...Object.values(data), 1);
  return (
    <div className="space-y-2">
      {Object.entries(data).length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No data.</p>
      ) : (
        Object.entries(data).map(([key, count]) => (
          <div key={key} className="flex items-center gap-3">
            <span className="w-20 text-xs font-medium capitalize truncate">{key.replace(/_/g, " ")}</span>
            <div className="flex-1 h-6 rounded-lg bg-muted overflow-hidden">
              <div className={`h-full rounded-lg transition-all duration-1000 ${colorMap[key] || "bg-primary"}`} style={{ width: `${(count / maxVal) * 100}%` }} />
            </div>
            <span className="w-8 text-right text-sm font-mono">{count}</span>
          </div>
        ))
      )}
    </div>
  );
}

export default function AnalyticsContent(props: Props) {
  const { carers, clients, shifts, tasks, incidents, documents, notes, handovers, absences, locations } = props;

  // Derived metrics
  const totalCarers = carers.length;
  const totalClients = clients.length;
  const totalShifts = shifts.length;
  const completedShifts = shifts.filter(s => s.status === "completed").length;
  const missedShifts = shifts.filter(s => s.status === "missed" || s.status === "cancelled").length;
  const confirmedShifts = shifts.filter(s => s.status === "confirmed").length;
  const shiftCompletionRate = totalShifts > 0 ? Math.round((completedShifts / totalShifts) * 100) : 0;
  const shiftMissRate = totalShifts > 0 ? Math.round((missedShifts / totalShifts) * 100) : 0;

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === "completed").length;
  const pendingTasks = tasks.filter(t => t.status === "pending").length;
  const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const totalAbsences = absences.length;
  const sickAbsences = absences.filter(a => a.absence_type === "sick_leave").length;
  const holidayAbsences = absences.filter(a => a.absence_type === "holiday").length;

  const totalHandovers = handovers.length;
  const unreadHandovers = handovers.filter(h => !h.is_read).length;

  const greenDocs = documents.filter(d => d.status === "green").length;
  const amberDocs = documents.filter(d => d.status === "amber").length;
  const redDocs = documents.filter(d => d.status === "red").length;
  const totalDocs = greenDocs + amberDocs + redDocs;
  const complianceScore = totalDocs > 0 ? Math.round((greenDocs / totalDocs) * 100) : 0;

  const openIncidents = incidents.filter(i => i.status === "open").length;
  const resolvedIncidents = incidents.filter(i => i.status === "resolved").length;
  const totalIncidents = incidents.length;

  const totalNotes = notes.length;
  const noteCountByCarer: Record<string, number> = {};
  const moodCounts: Record<string, number> = {};
  notes.forEach(n => {
    if (n.carer_id) noteCountByCarer[n.carer_id] = (noteCountByCarer[n.carer_id] || 0) + 1;
    if (n.mood) moodCounts[n.mood] = (moodCounts[n.mood] || 0) + 1;
  });

  const incidentByCategory: Record<string, number> = {};
  const incidentBySeverity: Record<string, number> = {};
  const incidentByDay: Record<string, number> = {};
  incidents.forEach(i => {
    incidentByCategory[i.category] = (incidentByCategory[i.category] || 0) + 1;
    incidentBySeverity[i.severity] = (incidentBySeverity[i.severity] || 0) + 1;
    if (i.reported_at) {
      const day = new Date(i.reported_at).toLocaleDateString("en-GB", { weekday: "long" });
      incidentByDay[day] = (incidentByDay[day] || 0) + 1;
    }
  });

  const shiftsByCarer: Record<string, { total: number; completed: number; missed: number }> = {};
  shifts.forEach(s => {
    if (!s.carer_id) return;
    if (!shiftsByCarer[s.carer_id]) shiftsByCarer[s.carer_id] = { total: 0, completed: 0, missed: 0 };
    shiftsByCarer[s.carer_id].total++;
    if (s.status === "completed") shiftsByCarer[s.carer_id].completed++;
    if (s.status === "missed" || s.status === "cancelled") shiftsByCarer[s.carer_id].missed++;
  });

  const hoursByCarer: Record<string, number> = {};
  shifts.forEach(s => {
    if (!s.carer_id) return;
    const start = new Date(s.start_time);
    const end = new Date(s.end_time);
    const hrs = (end.getTime() - start.getTime()) / 3600000;
    hoursByCarer[s.carer_id] = (hoursByCarer[s.carer_id] || 0) + hrs;
  });

  const expiryCounts: Record<string, number> = {};
  const now = new Date();
  documents.forEach(d => {
    if (!d.expiry_date) return;
    const days = Math.ceil((new Date(d.expiry_date).getTime() - now.getTime()) / 86400000);
    if (days <= 0) expiryCounts["Expired"] = (expiryCounts["Expired"] || 0) + 1;
    else if (days <= 7) expiryCounts["This Week"] = (expiryCounts["This Week"] || 0) + 1;
    else if (days <= 30) expiryCounts["This Month"] = (expiryCounts["This Month"] || 0) + 1;
    else expiryCounts["30+ Days"] = (expiryCounts["30+ Days"] || 0) + 1;
  });

  const taskByCarer: Record<string, { completed: number; pending: number }> = {};
  tasks.forEach(t => {
    if (!t.carer_id) return;
    if (!taskByCarer[t.carer_id]) taskByCarer[t.carer_id] = { completed: 0, pending: 0 };
    if (t.status === "completed") taskByCarer[t.carer_id].completed++;
    else taskByCarer[t.carer_id].pending++;
  });

  const severityColors: Record<string, string> = { low: "bg-blue-400", medium: "bg-amber-400", high: "bg-red-400", critical: "bg-red-600" };
  const moodColors: Record<string, string> = { happy: "bg-green-400", neutral: "bg-blue-400", concerned: "bg-amber-400", distressed: "bg-red-400" };
  const expiryColors: Record<string, string> = { "Expired": "bg-red-500", "This Week": "bg-amber-500", "This Month": "bg-yellow-400", "30+ Days": "bg-green-400" };
  const categoryColors: Record<string, string> = {
    fall: "bg-orange-400", medication_error: "bg-red-400", safeguarding: "bg-teal-400",
    behaviour: "bg-yellow-400", missing_person: "bg-red-500", other: "bg-gray-400",
  };

  const mapLocations = useMemo(() => {
    const points: { lat: number; lng: number; name: string; type: "carer" | "client" }[] = [];
    locations.forEach(l => {
      const lat = Number((l as Record<string, unknown>).lat) || 0;
      const lng = Number((l as Record<string, unknown>).lng) || 0;
      if (lat && lng) {
        points.push({ lat, lng, name: l.name || "Unknown", type: "client" });
      }
    });
    clients.forEach(c => {
      if (c.location_id) {
        const loc = locations.find(l => l.id === c.location_id);
        const lat = Number((loc as Record<string, unknown>)?.lat) || 0;
        const lng = Number((loc as Record<string, unknown>)?.lng) || 0;
        if (lat && lng) {
          points.push({ lat, lng, name: c.full_name || "Client", type: "client" as const });
        }
      }
    });
    carers.forEach(c => {
      if (c.location_id) {
        const loc = locations.find(l => l.id === c.location_id);
        const lat = Number((loc as Record<string, unknown>)?.lat) || 0;
        const lng = Number((loc as Record<string, unknown>)?.lng) || 0;
        if (lat && lng) {
          points.push({ lat, lng, name: c.full_name || "Carer", type: "carer" as const });
        }
      }
    });
    return points;
  }, [locations, clients, carers]);

  const carerMap = Object.fromEntries(carers.map(c => [c.id, c]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">Comprehensive insights across your organisation.</p>
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Compliance" value={`${complianceScore}%`} sub={`${greenDocs}/${totalDocs} docs`} icon={TrendingUp} color={complianceScore >= 80 ? "text-green-500" : complianceScore >= 50 ? "text-amber-500" : "text-red-500"} />
        <StatCard label="Carers" value={String(totalCarers)} sub={`${carers.filter(c => c.auth_id).length} can login`} icon={Users} color="text-blue-500" />
        <StatCard label="Clients" value={String(totalClients)} icon={Heart} color="text-rose-500" />
        <StatCard label="Shift Completion" value={`${shiftCompletionRate}%`} sub={`${completedShifts}/${totalShifts}`} icon={Clock} color={shiftCompletionRate >= 80 ? "text-green-500" : "text-amber-500"} trend={shiftCompletionRate >= 80 ? "up" : "down"} />
        <StatCard label="Task Completion" value={`${taskCompletionRate}%`} sub={`${completedTasks}/${totalTasks}`} icon={CheckCircle2} color={taskCompletionRate >= 80 ? "text-green-500" : "text-amber-500"} />
        <StatCard label="Open Incidents" value={String(openIncidents)} icon={AlertTriangle} color={openIncidents > 0 ? "text-red-500" : "text-green-500"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Carer Performance */}
        <Card className="rounded-xl border border-border/50 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-2"><Users className="h-4 w-4" />Carer Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {carers.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No carers registered.</p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {carers.map(c => {
                  const shifts = shiftsByCarer[c.id];
                  const tasks = taskByCarer[c.id];
                  const hrs = hoursByCarer[c.id] ?? 0;
                  const notesCount = noteCountByCarer[c.id] ?? 0;
                  const absenceCount = absences.filter(a => a.carer_id === c.id).length;
                  const handoverCount = handovers.filter(h => h.from_carer_id === c.id).length;
                  return (
                    <div key={c.id} className="rounded-xl bg-muted/50 px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-sm font-medium">{c.full_name}</p>
                          <p className="text-[10px] text-muted-foreground capitalize">{c.role?.replace(/_/g, " ") || "Carer"}{c.auth_id ? "" : " · No login"}</p>
                        </div>
                        <Badge variant="outline" className={`rounded-md text-[10px] ${c.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>{c.status || "active"}</Badge>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center text-[10px] text-muted-foreground">
                        <div><span className="block text-xs font-semibold text-foreground">{shifts?.completed ?? 0}/{shifts?.total ?? 0}</span>Shifts</div>
                        <div><span className="block text-xs font-semibold text-foreground">{hrs.toFixed(1)}h</span>Hours</div>
                        <div><span className="block text-xs font-semibold text-foreground">{tasks?.completed ?? 0}/{((tasks?.completed ?? 0) + (tasks?.pending ?? 0))}</span>Tasks</div>
                        <div><span className="block text-xs font-semibold text-foreground">{absenceCount}</span>Absences</div>
                      </div>
                      {(shifts?.missed && shifts.missed > 0) && <p className="text-[10px] text-red-500 mt-1">{shifts.missed} missed shift{shifts.missed !== 1 ? "s" : ""}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Workload Distribution */}
        <Card className="rounded-xl border border-border/50 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-2"><Clock className="h-4 w-4" />Workload Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {carers.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No carers registered.</p>
            ) : (
              <div className="space-y-3">
                {carers
                  .map(c => ({ carer: c, hours: hoursByCarer[c.id] ?? 0 }))
                  .sort((a, b) => b.hours - a.hours)
                  .map(({ carer, hours }) => {
                    const maxHours = Math.max(...Object.values(hoursByCarer), 1);
                    return (
                      <div key={carer.id} className="flex items-center gap-3">
                        <span className="w-24 text-xs font-medium truncate">{carer.full_name?.split(" ")[0]}</span>
                        <div className="flex-1 h-5 rounded-lg bg-muted overflow-hidden">
                          <div className="h-full rounded-lg bg-primary transition-all" style={{ width: `${(hours / maxHours) * 100}%` }} />
                        </div>
                        <span className="w-12 text-right text-xs font-mono">{hours.toFixed(1)}h</span>
                      </div>
                    );
                  })}
              </div>
            )}
            {totalShifts > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs">
                <div className="rounded-lg bg-green-50 p-3"><p className="text-lg font-bold text-green-700">{completedShifts}</p><p className="text-green-600">Completed</p></div>
                <div className="rounded-lg bg-amber-50 p-3"><p className="text-lg font-bold text-amber-700">{confirmedShifts}</p><p className="text-amber-600">Upcoming</p></div>
                <div className="rounded-lg bg-red-50 p-3"><p className="text-lg font-bold text-red-700">{missedShifts}</p><p className="text-red-600">Missed</p></div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Client Coverage */}
        <Card className="rounded-xl border border-border/50 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-2"><Heart className="h-4 w-4" />Client Coverage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="rounded-xl bg-muted/50 p-4 text-center">
                <p className="text-3xl font-bold">{totalClients}</p>
                <p className="text-xs text-muted-foreground">Total Clients</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-4 text-center">
                <p className="text-3xl font-bold">{totalShifts}</p>
                <p className="text-xs text-muted-foreground">Total Shifts Logged</p>
              </div>
            </div>
            {clients.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground mb-2">Hours of Care Per Client</p>
                {clients.map(c => {
                  const clientShifts = shifts.filter(s => s.client_id === c.id);
                  const totalHrs = clientShifts.reduce((sum, s) => {
                    return sum + (new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 3600000;
                  }, 0);
                  const clientMax = Math.max(...clients.map(cl => {
                    return shifts.filter(s => s.client_id === cl.id).reduce((sum, s) => sum + (new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 3600000, 0);
                  }), 1);
                  return (
                    <div key={c.id} className="flex items-center gap-3">
                      <span className="w-28 text-xs font-medium truncate">{c.full_name}</span>
                      <div className="flex-1 h-4 rounded-lg bg-muted overflow-hidden">
                        <div className="h-full rounded-lg bg-rose-400 transition-all" style={{ width: `${(totalHrs / clientMax) * 100}%` }} />
                      </div>
                      <span className="w-10 text-right text-xs font-mono">{totalHrs.toFixed(0)}h</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Incident Trends */}
        <Card className="rounded-xl border border-border/50 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Incident Trends</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center text-xs">
              <div className="rounded-lg bg-red-50 p-2"><p className="text-lg font-bold text-red-700">{totalIncidents}</p><p className="text-red-600">Total</p></div>
              <div className="rounded-lg bg-amber-50 p-2"><p className="text-lg font-bold text-amber-700">{openIncidents}</p><p className="text-amber-600">Open</p></div>
              <div className="rounded-lg bg-green-50 p-2"><p className="text-lg font-bold text-green-700">{resolvedIncidents}</p><p className="text-green-600">Resolved</p></div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">By Severity</p>
              <BarChart data={incidentBySeverity} colorMap={severityColors} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">By Category</p>
              <BarChart data={incidentByCategory} colorMap={categoryColors} />
            </div>
            {Object.keys(incidentByDay).length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">By Day of Week</p>
                <BarChart data={incidentByDay} colorMap={{}} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Compliance Trends */}
        <Card className="rounded-xl border border-border/50 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-2"><FileText className="h-4 w-4" />Document Compliance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center text-xs">
              <div className="rounded-lg bg-green-50 p-2"><p className="text-lg font-bold text-green-700">{greenDocs}</p><p className="text-green-600">Compliant</p></div>
              <div className="rounded-lg bg-amber-50 p-2"><p className="text-lg font-bold text-amber-700">{amberDocs}</p><p className="text-amber-600">Expiring</p></div>
              <div className="rounded-lg bg-red-50 p-2"><p className="text-lg font-bold text-red-700">{redDocs}</p><p className="text-red-600">Expired</p></div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Expiry Timeline</p>
              <BarChart data={expiryCounts} colorMap={expiryColors} />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span className="text-sm font-medium">Overall Compliance Score</span>
              <span className={`text-2xl font-bold ${complianceScore >= 80 ? "text-green-600" : complianceScore >= 50 ? "text-amber-600" : "text-red-600"}`}>{complianceScore}%</span>
            </div>
          </CardContent>
        </Card>

        {/* Care Notes & Mood */}
        <Card className="rounded-xl border border-border/50 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-2"><MessageSquare className="h-4 w-4" />Care Notes & Wellbeing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-center text-xs">
              <div className="rounded-lg bg-muted/50 p-3"><p className="text-lg font-bold">{totalNotes}</p><p className="text-muted-foreground">Total Notes</p></div>
              <div className="rounded-lg bg-muted/50 p-3"><p className="text-lg font-bold">{Object.keys(noteCountByCarer).length}</p><p className="text-muted-foreground">Active Contributors</p></div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Mood Distribution</p>
              <BarChart data={moodCounts} colorMap={moodColors} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Notes Per Carer</p>
              <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                {Object.entries(noteCountByCarer)
                  .sort((a, b) => b[1] - a[1])
                  .map(([carerId, count]) => {
                    const name = carerMap[carerId]?.full_name || "Unknown";
                    const maxCount = Math.max(...Object.values(noteCountByCarer), 1);
                    return (
                      <div key={carerId} className="flex items-center gap-2">
                        <span className="w-24 text-[10px] font-medium truncate">{name}</span>
                        <div className="flex-1 h-3 rounded bg-muted overflow-hidden">
                          <div className="h-full rounded bg-cyan-400 transition-all" style={{ width: `${(count / maxCount) * 100}%` }} />
                        </div>
                        <span className="w-6 text-right text-[10px] font-mono">{count}</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Map */}
      <Card className="rounded-xl border border-border/50 shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2"><MapPin className="h-4 w-4" />Location Map</CardTitle>
        </CardHeader>
        <CardContent>
          {mapLocations.length === 0 ? (
            <div className="py-8 text-center">
              <MapPin className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No location data available.</p>
              <p className="text-xs text-muted-foreground mt-1">Add locations with addresses in Settings to see them on the map.</p>
            </div>
          ) : (
            <div className="h-[400px] rounded-xl overflow-hidden">
              <MapView locations={mapLocations} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="rounded-xl border border-border/50 shadow-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100"><MessageSquare className="h-5 w-5 text-blue-700" /></div>
            <div><p className="text-lg font-bold">{totalHandovers}</p><p className="text-xs text-muted-foreground">Handovers</p><p className="text-[10px] text-red-500">{unreadHandovers} unread</p></div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-border/50 shadow-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100"><CalendarX className="h-5 w-5 text-amber-700" /></div>
            <div><p className="text-lg font-bold">{totalAbsences}</p><p className="text-xs text-muted-foreground">Absences</p><p className="text-[10px] text-muted-foreground">{sickAbsences} sick · {holidayAbsences} holiday</p></div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-border/50 shadow-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100"><CheckCircle2 className="h-5 w-5 text-green-700" /></div>
            <div><p className="text-lg font-bold">{completedTasks}</p><p className="text-xs text-muted-foreground">Tasks Done</p><p className="text-[10px] text-muted-foreground">{pendingTasks} remaining</p></div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-border/50 shadow-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100"><Users className="h-5 w-5 text-teal-700" /></div>
            <div><p className="text-lg font-bold">{carers.filter(c => c.auth_id).length}/{totalCarers}</p><p className="text-xs text-muted-foreground">Carers with Login</p><p className="text-[10px] text-muted-foreground">{totalCarers - carers.filter(c => c.auth_id).length} manual only</p></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
