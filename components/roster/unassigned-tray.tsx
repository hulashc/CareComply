"use client";

import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { formatLondonShortDate } from "@/lib/dates/london";
import type { TrayItem } from "@/lib/roster-ui/tray";
import { cn } from "@/lib/utils";
import { timeRange } from "./format";

// Unassigned tray: everything that still needs a carer, soonest first, with how urgent it is.
// Virtualized, since a busy week can have hundreds. Click to select; drag onto a carer row to assign.

const ITEM_H = 64;
const URGENCY: Record<"red" | "amber" | "green", string> = {
  red: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100",
  amber: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
  green: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
};

interface Props {
  items: TrayItem[];
  selectedId: string | null;
  onSelect: (item: TrayItem) => void;
  /** Items can be dragged onto a carer row (HTML5 drag-and-drop). */
  draggable?: boolean;
}

export function UnassignedTray({ items, selectedId, onSelect, draggable }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({ count: items.length, getScrollElement: () => ref.current, estimateSize: () => ITEM_H, overscan: 8 });

  return (
    <section aria-label="Unassigned visits" className="flex h-full min-h-0 flex-col rounded-xl border bg-background">
      <header className="border-b px-3 py-2">
        <h2 className="text-sm font-semibold">Needs a carer</h2>
        <p className="text-xs text-muted-foreground">{items.length} upcoming, soonest first</p>
      </header>
      {items.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">Everything in view is covered.</p>
      ) : (
        <div ref={ref} role="list" className="min-h-0 flex-1 overflow-auto overscroll-contain">
          <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((vi) => {
              const it = items[vi.index];
              return (
                <div key={it.visit.id} role="listitem" className="absolute left-0 w-full px-2" style={{ top: vi.start, height: vi.size }}>
                  <button
                    type="button"
                    draggable={draggable}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/x-roster-visit", it.visit.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={() => onSelect(it)}
                    aria-label={`${it.urgency.label}: ${it.visit.client_name}, ${formatLondonShortDate(it.visit.start_time)} ${timeRange(it.visit)}, needs ${it.needed} carer${it.needed === 1 ? "" : "s"}`}
                    className={cn(
                      "mt-1 flex h-[56px] w-full flex-col justify-center rounded-lg border px-2.5 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      it.visit.id === selectedId && "ring-2 ring-primary",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold">{it.visit.client_name}</span>
                      <span className={cn("shrink-0 rounded px-1.5 text-[10px] font-semibold", URGENCY[it.urgency.level])}>{it.urgency.label}</span>
                    </span>
                    <span className="truncate text-[11px] text-muted-foreground">
                      {formatLondonShortDate(it.visit.start_time)} · {timeRange(it.visit)} · needs {it.needed}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
