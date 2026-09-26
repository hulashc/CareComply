import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarClock, Users, MapPin, Clock, LayoutList, CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { ShiftActions } from "@/components/shared/shift-actions";
import { ShiftCalendar } from "@/components/shared/shift-calendar";
import { WeekView } from "@/components/shared/week-view";
import { CsvExport } from "@/components/shared/csv-export";
import { DeleteButton } from "@/components/shared/delete-button";
import ShiftForm from "./shift-form";
import ShiftViewToggle from "./shift-view-toggle";
import type { Tables } from "@/lib/database.types";

type ShiftRow = Tables<"shifts">;
type ClientRow = Tables<"clients">;
type CarerRow = Tables<"carers">;

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700 border-blue-300",
  in_progress: "bg-amber-100 text-amber-700 border-amber-300",
  completed: "bg-green-100 text-green-700 border-green-300",
  cancelled: "bg-red-100 text-red-700 border-red-300",
};

export default async function ShiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; month?: string; year?: string }>;
}) {
  const { view, month, year } = await searchParams;
  const isWeek = view === "week";
  const isCalendar = view === "calendar" || view === "month";

  const now = new Date();
  const calMonth = month ? parseInt(month) : now.getMonth();
  const calYear = year ? parseInt(year) : now.getFullYear();

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));

  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  const orgId = admin?.org_id ?? "";

  let rangeStart: string;
  if (isCalendar) {
    rangeStart = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-01`;
  } else if (isWeek) {
    rangeStart = weekStart.toISOString().split("T")[0];
  } else {
    rangeStart = now.toISOString().split("T")[0];
  }

  const { data: shifts } = await supabase
    .from("shifts")
    .select("*")
    .eq("org_id", orgId)
    .order("start_time", { ascending: true })
    .gte("start_time", rangeStart)
    .returns<ShiftRow[]>();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, full_name")
    .eq("org_id", orgId)
    .returns<Pick<ClientRow, "id" | "full_name">[]>();

  const { data: carers } = await supabase
    .from("carers")
    .select("id, full_name")
    .eq("org_id", orgId)
    .returns<Pick<CarerRow, "id" | "full_name">[]>();

  function getClientName(id: string) { return clients?.find((c) => c.id === id)?.full_name ?? "Unknown"; }
  function getCarerName(id: string | null) { return id ? (carers?.find((c) => c.id === id)?.full_name ?? "Unknown") : "Unassigned"; }
  function formatShiftTime(start: string, end: string) {
    const s = new Date(start); const e = new Date(end);
    return `${s.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${e.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  function groupByDate(list: ShiftRow[]) {
    const g: Record<string, ShiftRow[]> = {};
    for (const s of list) { const d = new Date(s.start_time).toLocaleDateString(); if (!g[d]) g[d] = []; g[d].push(s); }
    return g;
  }

  const grouped = shifts ? groupByDate(shifts) : {};

  const calendarShifts = (shifts ?? []).map((s) => ({
    id: s.id,
    start_time: s.start_time,
    end_time: s.end_time,
    status: s.status,
    client_name: getClientName(s.client_id),
    carer_name: getCarerName(s.carer_id),
  }));

  const csvData = (shifts ?? []).map((s) => ({
    Date: new Date(s.start_time).toLocaleDateString(),
    Time: formatShiftTime(s.start_time, s.end_time),
    Client: getClientName(s.client_id),
    Carer: getCarerName(s.carer_id),
    Status: s.status,
  }));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Shifts</h1>
          <p className="mt-1 text-sm text-muted-foreground">{shifts?.length ?? 0} shift{(shifts?.length ?? 1) !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <ShiftViewToggle currentView={isCalendar ? "calendar" : isWeek ? "week" : "list"} />
          <CsvExport data={csvData} filename={`shifts-${calYear}-${calMonth + 1}`} />
        </div>
      </div>

      <ShiftForm clients={clients ?? []} carers={carers ?? []} />

      {isWeek ? (
        <WeekView shifts={calendarShifts} startDate={weekStart} />
      ) : isCalendar ? (
        <ShiftCalendar shifts={calendarShifts} month={calMonth} year={calYear} />
      ) : Object.keys(grouped).length === 0 ? (
        <Card className="rounded-xl border border-border/50 shadow-card">
          <CardContent className="py-12">
            <EmptyState icon={CalendarClock} title="No shifts scheduled" description="Create your first shift to assign a carer to a client." />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, dayShifts]) => (
            <div key={date}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {new Date(date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
              </h2>
              <Card className="rounded-xl border border-border/50 shadow-card">
                <CardContent className="divide-y p-0">
                  {dayShifts.map((shift) => (
                    <div key={shift.id} className="flex flex-col sm:flex-row sm:items-center gap-2 px-5 py-4">
                      <div className="flex items-center gap-2 text-sm font-medium min-w-[120px]">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        {formatShiftTime(shift.start_time, shift.end_time)}
                      </div>
                      <div className="flex items-center gap-2 text-sm flex-1">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium">{getClientName(shift.client_id)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        {getCarerName(shift.carer_id)}
                      </div>
                      <Badge variant="outline" className={`rounded-md text-[10px] ${statusColors[shift.status] || ""}`}>
                        {shift.status.replace("_", " ").toUpperCase()}
                      </Badge>
                      {(shift.status === "scheduled" || shift.status === "in_progress") && (
                        <>
                          <ShiftActions shiftId={shift.id} status={shift.status} />
                          <DeleteButton apiUrl={`/api/shifts/${shift.id}`} entityName="shift" variant="ghost" size="icon" />
                        </>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
