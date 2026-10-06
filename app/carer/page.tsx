import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, ClipboardList, MessageSquare, AlertTriangle, Pill, CalendarClock, ArrowRight, Bell } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { StatusBadge } from "@/components/shared/status-badge";
import { CheckInOutButton } from "@/components/carer/check-in-out-button";

export default async function CarerHomePage() {
  const cookieStore = await cookies();
  const authClient = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) redirect("/auth/login");

  const svc = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data: carer } = await svc.from("carers").select("*").eq("auth_id", user.id).single();
  if (!carer) redirect("/auth/login");

  const today = new Date().toISOString().split("T")[0];

  const [shiftsRes, tasksRes, handoversRes] = await Promise.all([
    svc.from("shifts").select("*, clients(full_name)").eq("carer_id", carer.id).gte("start_time", today).order("start_time", { ascending: true }).limit(10),
    svc.from("tasks").select("*, clients(full_name)").eq("carer_id", carer.id).eq("status", "pending").order("created_at", { ascending: false }).limit(10),
    svc.from("handover_notes").select("*, clients(full_name)").eq("to_carer_id", carer.id).eq("is_read", false).order("created_at", { ascending: false }).limit(5),
  ]);

  const shifts = shiftsRes.data ?? [];
  const tasks = tasksRes.data ?? [];
  const handovers = handoversRes.data ?? [];
  const clientNames = [...new Set(shifts.map(s => s.clients?.full_name).filter(Boolean))];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">
          Hello, {carer.full_name?.split(" ")[0] ?? "there"}
        </h1>
        <p className="text-sm text-slate-500">
          {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-xl bg-white border border-slate-200 p-3 text-center shadow-sm">
          <Clock className="h-5 w-5 text-fuchsia-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-slate-900">{shifts.length}</p>
          <p className="text-[10px] font-medium text-slate-500">Shifts</p>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 p-3 text-center shadow-sm">
          <Users className="h-5 w-5 text-fuchsia-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-slate-900">{clientNames.length}</p>
          <p className="text-[10px] font-medium text-slate-500">Clients</p>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 p-3 text-center shadow-sm">
          <ClipboardList className="h-5 w-5 text-rose-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-slate-900">{tasks.length}</p>
          <p className="text-[10px] font-medium text-slate-500">Tasks</p>
        </div>
      </div>

      <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-fuchsia-500" />
            <h2 className="text-sm font-bold text-slate-800">Today&apos;s Roster</h2>
          </div>
          {shifts.length > 0 && (
            <Badge className="rounded-full bg-fuchsia-50 text-fuchsia-600 border-0 text-[10px] font-semibold">{shifts.length} visits</Badge>
          )}
        </div>
        {shifts.length === 0 ? (
          <div className="py-5 text-center">
            <CalendarClock className="h-8 w-8 text-slate-300 mx-auto mb-1" />
            <p className="text-sm font-semibold text-slate-500">No shifts today</p>
          </div>
        ) : (
          <div className="space-y-2">
            {shifts.map((s) => {
              // Only offer check-in within an hour of the start; check-out once checked in.
              const canCheckIn =
                !s.actual_start && s.status === "scheduled" && new Date(s.start_time).getTime() - Date.now() < 60 * 60 * 1000;
              const canCheckOut = !!s.actual_start && !s.actual_end && s.status === "in_progress";
              return (
                <div key={s.id} className="space-y-1.5">
                  <Link href={`/carer/clients/${s.client_id}`} className="block">
                    <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3 hover:border-fuchsia-200 hover:bg-fuchsia-50/30 transition-colors active:scale-[0.99]">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-fuchsia-500 text-white text-xs font-bold">
                        {s.clients?.full_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() ?? "?"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-800 truncate">{s.clients?.full_name ?? "Unknown"}</p>
                        <p className="text-xs text-slate-500">
                          <Clock className="h-3 w-3 inline mr-0.5" />
                          {new Date(s.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} — {new Date(s.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <StatusBadge status={s.status} />
                    </div>
                  </Link>
                  {canCheckIn && <CheckInOutButton shiftId={s.id} action="check_in" />}
                  {canCheckOut && <CheckInOutButton shiftId={s.id} action="check_out" />}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {handovers.length > 0 && (
        <div className="rounded-xl bg-white border border-slate-200 border-l-4 border-l-amber-400 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-amber-500" />
              <h2 className="text-sm font-bold text-slate-800">Handovers</h2>
            </div>
            <Badge className="rounded-full bg-amber-50 text-amber-600 border-0 text-[10px] font-semibold">{handovers.length} new</Badge>
          </div>
          <div className="space-y-2">
            {handovers.map((h) => (
              <Link key={h.id} href="/carer/handovers" className="block">
                <div className="rounded-lg bg-amber-50/50 border border-amber-100 p-3">
                  <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">{h.clients?.full_name ?? "Unknown"}</span>
                  <p className="text-sm text-slate-700 line-clamp-2 mt-0.5">{h.note_text}</p>
                  {h.tasks_remaining && (
                    <p className="text-xs text-amber-600 mt-1 font-medium flex items-center gap-1">
                      <ClipboardList className="h-3 w-3" />
                      {h.tasks_remaining}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {tasks.length > 0 && (
        <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-rose-500" />
              <h2 className="text-sm font-bold text-slate-800">Pending Tasks</h2>
            </div>
            <Badge className="rounded-full bg-rose-50 text-rose-600 border-0 text-[10px] font-semibold">{tasks.length}</Badge>
          </div>
          <div className="space-y-1">
            {tasks.slice(0, 5).map((t) => (
              <Link key={t.id} href="/carer/tasks" className="block">
                <div className="flex items-center gap-2.5 rounded-lg border border-slate-100 bg-slate-50/50 p-2.5 hover:border-rose-200 hover:bg-rose-50/30 transition-colors">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-50">
                    <ClipboardList className="h-3.5 w-3.5 text-rose-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800 truncate">{t.title}</p>
                    <p className="text-[10px] text-slate-500">{t.clients?.full_name ?? "—"}</p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-300" />
                </div>
              </Link>
            ))}
            {tasks.length > 5 && (
              <Link href="/carer/tasks" className="block text-center text-xs font-semibold text-fuchsia-600 py-1.5">
                +{tasks.length - 5} more tasks
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2.5">
        <Link href="/carer/notes" className="block">
          <div className="rounded-xl bg-white border border-slate-200 p-3.5 text-center shadow-sm hover:border-fuchsia-200 hover:shadow-md transition-all active:scale-[0.97]">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-fuchsia-500 mx-auto mb-1.5">
              <Pill className="h-5 w-5 text-white" />
            </div>
            <span className="text-xs font-bold text-slate-700">MAR Notes</span>
          </div>
        </Link>
        <Link href="/carer/handovers" className="block">
          <div className="rounded-xl bg-white border border-slate-200 p-3.5 text-center shadow-sm hover:border-fuchsia-200 hover:shadow-md transition-all active:scale-[0.97]">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-fuchsia-500 mx-auto mb-1.5">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
            <span className="text-xs font-bold text-slate-700">Handover</span>
          </div>
        </Link>
        <Link href="/carer/incidents" className="block">
          <div className="rounded-xl bg-white border border-slate-200 p-3.5 text-center shadow-sm hover:border-rose-200 hover:shadow-md transition-all active:scale-[0.97]">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500 mx-auto mb-1.5">
              <AlertTriangle className="h-5 w-5 text-white" />
            </div>
            <span className="text-xs font-bold text-slate-700">Incident</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
