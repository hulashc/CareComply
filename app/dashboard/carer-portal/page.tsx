import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, CheckCircle2, Circle, MessageSquare, Pill, ClipboardList, Smartphone } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/shared/status-badge";
import type { Tables } from "@/lib/database.types";

export default async function CarerPortalPage() {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  const orgId = admin?.org_id ?? "";
  const today = new Date().toISOString().split("T")[0];

  const { data: carers } = await supabase.from("carers").select("id, full_name").eq("org_id", orgId).limit(10);

  const firstCarerId = carers?.[0]?.id;

  const { data: shifts } = await supabase
    .from("shifts")
    .select("*, clients(full_name)")
    .eq("shifts.org_id", orgId)
    .gte("start_time", today)
    .order("start_time", { ascending: true })
    .limit(15)
    .returns<(Tables<"shifts"> & { clients: { full_name: string } | null })[]>();

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*, clients(full_name)")
    .eq("tasks.org_id", orgId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(10)
    .returns<(Tables<"tasks"> & { clients: { full_name: string } | null })[]>();

  const { data: handovers } = await supabase
    .from("handover_notes")
    .select("*, clients(full_name)")
    .eq("handover_notes.org_id", orgId)
    .eq("is_read", false)
    .order("created_at", { ascending: false })
    .limit(5)
    .returns<(Tables<"handover_notes"> & { clients: { full_name: string } | null })[]>();

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Smartphone className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Carer Portal</h1>
        <p className="mt-1 text-sm text-muted-foreground">Mobile-friendly view for carers on the go.</p>
      </div>

      <Card className="rounded-xl border border-border/50 shadow-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">Today&apos;s Roster</CardTitle>
            <Badge className="rounded-md">{shifts?.length ?? 0} shifts</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {!shifts || shifts.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No shifts scheduled for today.</div>
          ) : (
            <div className="space-y-2">
              {shifts.map(s => (
                <div key={s.id} className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
                  <div>
                    <p className="font-medium">{s.clients?.full_name ?? "Unknown"}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3" />
                      {new Date(s.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {" — "}
                      {new Date(s.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <StatusBadge status={s.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {tasks && tasks.length > 0 && (
        <Card className="rounded-xl border border-border/50 shadow-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">Pending Tasks</CardTitle>
              <Badge className="rounded-md bg-amber-100 text-amber-700">{tasks.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {tasks.map(t => (
                <div key={t.id} className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Circle className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{t.title}</p>
                      <p className="text-xs text-muted-foreground">{t.clients?.full_name ?? "—"} {t.due_date ? `· Due ${new Date(t.due_date).toLocaleDateString()}` : ""}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {handovers && handovers.length > 0 && (
        <Card className="rounded-xl border border-border/50 shadow-card border-l-4 border-l-amber-400">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">Unread Handovers</CardTitle>
              <Badge className="rounded-md bg-amber-100 text-amber-700">{handovers.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {handovers.map(h => (
                <div key={h.id} className="rounded-xl bg-amber-50 px-4 py-3">
                  <p className="text-sm font-medium">{h.clients?.full_name ?? "Unknown"}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{h.note_text}</p>
                  {h.tasks_remaining && (
                    <p className="text-xs text-amber-700 mt-1 font-medium">Remaining: {h.tasks_remaining}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Link href="/dashboard/shifts"><Card className="rounded-xl border border-border/50 shadow-card hover:shadow-elevated transition-shadow cursor-pointer"><CardContent className="flex flex-col items-center gap-2 p-4"><Clock className="h-6 w-6 text-primary" /><span className="text-xs font-medium">Roster</span></CardContent></Card></Link>
        <Link href="/dashboard/clients"><Card className="rounded-xl border border-border/50 shadow-card hover:shadow-elevated transition-shadow cursor-pointer"><CardContent className="flex flex-col items-center gap-2 p-4"><MapPin className="h-6 w-6 text-primary" /><span className="text-xs font-medium">Clients</span></CardContent></Card></Link>
        <Link href="/dashboard/handovers"><Card className="rounded-xl border border-border/50 shadow-card hover:shadow-elevated transition-shadow cursor-pointer"><CardContent className="flex flex-col items-center gap-2 p-4"><MessageSquare className="h-6 w-6 text-primary" /><span className="text-xs font-medium">Handovers</span></CardContent></Card></Link>
      </div>
    </div>
  );
}
