"use client";

import { useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { formatLondonShortDate } from "@/lib/dates/london";
import { STATUS_STYLES } from "@/lib/roster-ui/status";
import type { VisitRow } from "@/lib/roster/types";
import { cn } from "@/lib/utils";
import { carerNames, describeVisit, timeRange } from "./format";

// Mobile manager view: a virtualized agenda (day headers + visit cards). A resource grid needs width
// a phone does not have; this keeps every visit reachable with one thumb.

type Entry = { kind: "head"; day: string; count: number } | { kind: "visit"; v: VisitRow };
const HEAD_H = 36;
const CARD_H = 76;

interface Props {
  days: string[];
  byDay: Map<string, VisitRow[]>;
  selectedId: string | null;
  onSelect: (v: VisitRow) => void;
}

export function AgendaView({ days, byDay, selectedId, onSelect }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const entries = useMemo<Entry[]>(
    () => days.flatMap((day) => {
      const vs = byDay.get(day) ?? [];
      return vs.length ? [{ kind: "head" as const, day, count: vs.length }, ...vs.map((v) => ({ kind: "visit" as const, v }))] : [];
    }),
    [days, byDay],
  );
  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => ref.current,
    estimateSize: (i) => (entries[i].kind === "head" ? HEAD_H : CARD_H),
    overscan: 8,
  });

  if (entries.length === 0) return <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">No visits match.</div>;

  return (
    <div ref={ref} role="list" aria-label="Visits" className="h-full overflow-auto overscroll-contain rounded-xl border bg-background">
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((vi) => {
          const e = entries[vi.index];
          return (
            <div key={vi.key} role="listitem" className="absolute left-0 w-full px-2" style={{ top: vi.start, height: vi.size }}>
              {e.kind === "head" ? (
                <h3 className="flex h-full items-end pb-1 text-xs font-semibold text-muted-foreground">
                  {formatLondonShortDate(`${e.day}T12:00:00Z`)} · {e.count} visits
                </h3>
              ) : (
                <button
                  type="button"
                  onClick={() => onSelect(e.v)}
                  aria-label={describeVisit(e.v)}
                  className={cn(
                    "mt-1 flex h-[68px] w-full flex-col justify-center rounded-lg border border-l-4 px-3 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    STATUS_STYLES[e.v.status].block,
                    e.v.roster_state === "draft" && "border-dashed",
                    e.v.id === selectedId && "ring-2 ring-primary",
                  )}
                >
                  <span className="truncate font-semibold">{timeRange(e.v)} · {e.v.client_name}</span>
                  <span className="truncate text-xs opacity-80">{carerNames(e.v)}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
