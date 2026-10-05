"use client";

import { cn } from "@/lib/utils";

type ShiftCalendarProps = {
  shifts: {
    id: string;
    start_time: string;
    end_time: string;
    status: string;
    client_name: string;
    carer_name: string;
  }[];
  month: number;
  year: number;
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function ShiftCalendar({ shifts, month, year }: ShiftCalendarProps) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;

  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function getShiftsForDay(day: number) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return shifts.filter((s) => s.start_time.startsWith(dateStr));
  }

  const isToday = (day: number) => {
    const now = new Date();
    return day === now.getDate() && month === now.getMonth() && year === now.getFullYear();
  };

  return (
    <div className="rounded-2xl border bg-card">
      <div className="grid grid-cols-7 border-b">
        {DAYS.map((d) => (
          <div key={d} className="px-2 py-2 text-center text-[10px] font-medium uppercase text-muted-foreground">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          const dayShifts = day ? getShiftsForDay(day) : [];
          return (
            <div
              key={i}
              className={cn(
                "min-h-[60px] border-b border-r p-1.5 text-xs",
                i % 7 === 6 && "border-r-0",
                !day && "bg-muted/20"
              )}
            >
              {day && (
                <>
                  <span
                    className={cn(
                      "inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium",
                      isToday(day) ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                    )}
                  >
                    {day}
                  </span>
                  <div className="mt-0.5 space-y-0.5">
                    {dayShifts.slice(0, 2).map((s) => (
                      <div
                        key={s.id}
                        className={cn(
                          "truncate rounded px-1 py-0.5 text-[10px] font-medium",
                          s.status === "completed" ? "bg-green-100 text-green-700" :
                          s.status === "cancelled" ? "bg-red-100 text-red-700 line-through" :
                          "bg-blue-100 text-blue-700"
                        )}
                        title={`${s.client_name} - ${s.carer_name}`}
                      >
                        {s.client_name}
                      </div>
                    ))}
                    {dayShifts.length > 2 && (
                      <span className="text-[10px] text-muted-foreground">+{dayShifts.length - 2} more</span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
