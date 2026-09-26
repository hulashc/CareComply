"use client";

import { cn } from "@/lib/utils";

type WeekViewProps = {
  shifts: {
    id: string;
    start_time: string;
    end_time: string;
    status: string;
    client_name: string;
    carer_name: string;
  }[];
  startDate: Date;
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 17 }, (_, i) => i + 7);

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700 border-blue-300",
  in_progress: "bg-amber-100 text-amber-700 border-amber-300",
  completed: "bg-green-100 text-green-700 border-green-300",
  cancelled: "bg-red-100 text-red-700 border-red-300 line-through",
};

export function WeekView({ shifts, startDate }: WeekViewProps) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    return d;
  });

  function getShiftsForDay(date: Date) {
    const dateStr = date.toISOString().split("T")[0];
    return shifts.filter((s) => s.start_time.startsWith(dateStr));
  }

  function getTop(hour: string) {
    const h = parseInt(hour.split(":")[0]);
    const m = parseInt(hour.split(":")[1]);
    return (h - 7) * 60 + m;
  }

  function getHeight(start: string, end: string) {
    const sTop = getTop(start);
    const eTop = getTop(end);
    return Math.max(eTop - sTop, 20);
  }

  return (
    <div className="overflow-auto rounded-2xl border bg-card">
      <div className="grid grid-cols-[60px_repeat(7,1fr)] min-w-[700px]">
        <div className="border-b border-r px-2 py-2 text-center text-[10px] font-medium uppercase text-muted-foreground">Time</div>
        {days.map((d, i) => (
          <div key={i} className={cn("border-b px-2 py-2 text-center text-[10px] font-medium uppercase", i < 6 ? "border-r" : "")}>
            <span className={cn(d.toDateString() === new Date().toDateString() && "text-primary font-bold")}>{DAYS[i]}</span>
            <span className="block text-[11px] text-muted-foreground">{d.getDate()}/{d.getMonth() + 1}</span>
          </div>
        ))}
        {HOURS.map((h) => (
          <>
            <div key={`h-${h}`} className="border-r border-b px-1.5 py-0.5 text-right text-[10px] text-muted-foreground">{String(h).padStart(2, "0")}:00</div>
            {days.map((d, i) => (
              <div key={`${h}-${i}`} className={cn("border-b relative", i < 6 ? "border-r" : "")} style={{ height: "60px" }}>
                {getShiftsForDay(d).map((s) => {
                  const top = getTop(new Date(s.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }));
                  const height = getHeight(
                    new Date(s.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
                    new Date(s.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
                  );
                  if (h === 7 || (top >= (h - 7) * 60 && top < (h - 6) * 60)) {
                    return (
                      <div
                        key={s.id}
                        className={cn("absolute left-0.5 right-0.5 rounded px-1 py-0.5 text-[9px] font-medium leading-tight overflow-hidden", statusColors[s.status] || "bg-gray-100")}
                        style={{ top: `${(top % 60) / 60 * 100}%`, height: `${Math.max(height, 15)}px` }}
                        title={`${s.client_name} - ${s.carer_name}`}
                      >
                        {s.client_name}
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            ))}
          </>
        ))}
      </div>
    </div>
  );
}
