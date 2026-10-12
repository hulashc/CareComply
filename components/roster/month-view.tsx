"use client";

import { STATUS_ORDER, STATUS_STYLES } from "@/lib/roster-ui/status";
import type { VisitRow } from "@/lib/roster/types";
import { cn } from "@/lib/utils";

// Month grid: one cell per day with the visit count, a status breakdown and the unassigned count.
// Deliberately counts, not chips: 40+ visits a day cannot be listed in a cell. Click a day to open
// it in the Day view. 42 cells, so it needs no virtualization.

interface Props {
  days: string[]; // 42 dates, Monday first
  month: number; // 1-12, the month being shown (other days are dimmed)
  byDay: Map<string, VisitRow[]>;
  today: string;
  onPickDay: (day: string) => void;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function MonthView({ days, month, byDay, today, onPickDay }: Props) {
  return (
    <div className="h-full overflow-auto rounded-xl border bg-background">
      <div className="grid min-w-[40rem] grid-cols-7" role="grid" aria-label="Month overview">
        {WEEKDAYS.map((w) => (
          <div key={w} role="columnheader" className="border-b px-2 py-1.5 text-xs font-semibold text-muted-foreground">
            {w}
          </div>
        ))}
        {days.map((day) => {
          const visits = byDay.get(day) ?? [];
          const live = visits.filter((v) => v.status !== "cancelled");
          const open = live.filter((v) => v.open_slots > 0).length;
          const counts = STATUS_ORDER.map((s) => [s, visits.filter((v) => v.status === s).length] as const).filter(([, n]) => n > 0);
          const inMonth = Number(day.slice(5, 7)) === month;
          return (
            <button
              key={day}
              type="button"
              role="gridcell"
              onClick={() => onPickDay(day)}
              aria-label={`${day}: ${live.length} visits, ${open} still need a carer. Open day view`}
              className={cn(
                "flex min-h-24 flex-col items-stretch gap-1 border-b border-r p-1.5 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                !inMonth && "bg-muted/40 text-muted-foreground",
                day === today && "bg-primary/10",
              )}
            >
              <span className={cn("text-xs font-semibold", day === today && "text-primary")}>{Number(day.slice(8, 10))}</span>
              {live.length > 0 && <span className="text-xs">{live.length} visits</span>}
              {open > 0 && <span className="w-fit rounded bg-red-100 px-1 text-[10px] font-semibold text-red-900 dark:bg-red-950 dark:text-red-100">{open} open</span>}
              <span className="mt-auto flex h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                {counts.map(([s, n]) => (
                  <span key={s} className={STATUS_STYLES[s].dot} style={{ width: `${(n / Math.max(1, visits.length)) * 100}%` }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
