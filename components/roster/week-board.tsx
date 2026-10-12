"use client";

import { useEffect, useRef, useState } from "react";
import { formatLondonShortDate, formatLondonTime } from "@/lib/dates/london";
import { hasBlocking, type Conflict } from "@/lib/roster-ui/conflicts";
import { fixedRowWindow } from "@/lib/roster-ui/layout";
import { DRAFT_CLASS, STATUS_STYLES } from "@/lib/roster-ui/status";
import type { VisitRow } from "@/lib/roster/types";
import { cn } from "@/lib/utils";
import { carerNames, describeVisit, shortName } from "./format";

// Week board: seven day columns, each a time-ordered list of visit chips. A time grid is unreadable
// at ~150 visits a day (everything overlaps), so each column is a virtualized list instead: only the
// chips in the scroll window are in the DOM. All columns share one scroll, so one window serves all.

const CHIP_H = 30;
const HEAD_H = 44;

export interface WeekEdit {
  selection: ReadonlySet<string>;
  conflicts: Map<string, Conflict[]>;
  select: (id: string, mode: "replace" | "toggle") => void;
  open: (v: VisitRow) => void;
  /** Move visits to another day, keeping their London time of day. */
  moveToDay: (ids: string[], day: string) => void;
  create: (day: string, at: { x: number; y: number }) => void;
  context: (at: { x: number; y: number }, visit: VisitRow | null, day: string) => void;
}

interface Props {
  edit?: WeekEdit;
  days: string[];
  byDay: Map<string, VisitRow[]>;
  today: string;
  selectedId: string | null;
  onSelect: (v: VisitRow) => void;
  onPickDay: (day: string) => void;
}

export function WeekBoard({ days, byDay, today, selectedId, onSelect, onPickDay, edit }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [win, setWin] = useState({ top: 0, height: 700 });
  const [active, setActive] = useState<[number, number]>([0, 0]);
  const pending = useRef(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      setWin((w) => (w.top === el.scrollTop && w.height === el.clientHeight ? w : { top: el.scrollTop, height: el.clientHeight }));
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    el.addEventListener("scroll", schedule, { passive: true });
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", schedule);
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const columns = days.map((d) => byDay.get(d) ?? []);
  const tallest = Math.max(1, ...columns.map((c) => c.length));
  const [first, last] = fixedRowWindow(win.top, win.height - HEAD_H, CHIP_H, tallest, 4);

  const clamp = (c: number, r: number): [number, number] => {
    const col = Math.min(days.length - 1, Math.max(0, c));
    return [col, Math.min(Math.max(0, columns[col].length - 1), Math.max(0, r))];
  };
  const [ac, ar] = clamp(active[0], active[1]);

  const move = (e: React.KeyboardEvent) => {
    const delta: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], Home: [0, -9999], End: [0, 9999] };
    const d = delta[e.key];
    if (!d) return;
    e.preventDefault();
    const [nc, nr] = clamp(ac + d[0], ar + d[1]);
    setActive([nc, nr]);
    pending.current = true;
    const el = scrollRef.current;
    if (el) {
      const y = nr * CHIP_H;
      if (y < el.scrollTop) el.scrollTop = y;
      else if (y + CHIP_H > el.scrollTop + el.clientHeight - HEAD_H) el.scrollTop = y + CHIP_H - el.clientHeight + HEAD_H;
    }
  };

  useEffect(() => {
    if (!pending.current) return;
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-cell="${ac}:${ar}"]`);
    if (el) {
      el.focus({ preventScroll: true });
      pending.current = false;
    }
  }, [ac, ar, first, last]);

  return (
    <div ref={scrollRef} role="grid" aria-label="Week of visits by day" onKeyDown={move} className="h-full overflow-auto overscroll-contain rounded-xl border bg-background">
      <div className="relative grid min-w-[56rem] grid-cols-7" style={{ height: HEAD_H + tallest * CHIP_H }}>
        {days.map((day, ci) => (
          <div
            key={day}
            role="presentation"
            className="relative border-r last:border-r-0"
            onDragOver={(e) => {
              if (edit && e.dataTransfer.types.includes("application/x-roster-move")) e.preventDefault();
            }}
            onDrop={(e) => {
              const raw = e.dataTransfer.getData("application/x-roster-move");
              if (!edit || !raw) return;
              e.preventDefault();
              edit.moveToDay(JSON.parse(raw) as string[], day);
            }}
            onDoubleClick={(e) => edit && e.target === e.currentTarget && edit.create(day, { x: e.clientX, y: e.clientY })}
            onContextMenu={(e) => {
              if (!edit || e.target !== e.currentTarget) return;
              e.preventDefault();
              edit.context({ x: e.clientX, y: e.clientY }, null, day);
            }}
          >
            <button
              type="button"
              onClick={() => onPickDay(day)}
              aria-label={`Open ${formatLondonShortDate(`${day}T12:00:00Z`)} in day view, ${columns[ci].length} visits`}
              className={cn(
                "sticky top-0 z-10 flex w-full flex-col items-start border-b bg-background px-2 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                day === today && "bg-primary/10",
              )}
              style={{ height: HEAD_H }}
            >
              <span className="text-xs font-semibold">{formatLondonShortDate(`${day}T12:00:00Z`)}</span>
              <span className="text-[10px] text-muted-foreground">
                {columns[ci].length} visits · {columns[ci].filter((v) => v.open_slots > 0 && v.status !== "cancelled").length} open
              </span>
            </button>
            {columns[ci].slice(first, last + 1).map((v, i) => {
              const r = first + i;
              const style = STATUS_STYLES[v.status];
              return (
                <button
                  key={v.id}
                  type="button"
                  role="gridcell"
                  data-cell={`${ci}:${r}`}
                  tabIndex={ci === ac && r === ar ? 0 : -1}
                  aria-label={describeVisit(v)}
                  title={edit?.conflicts.get(v.id)?.map((c) => c.message).join("\n") ?? describeVisit(v)}
                  draggable={!!edit && v.status !== "in_progress" && v.status !== "completed"}
                  onDragStart={(e) => {
                    if (!edit) return;
                    const ids = edit.selection.has(v.id) ? [...edit.selection] : [v.id];
                    e.dataTransfer.setData("application/x-roster-move", JSON.stringify(ids));
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDoubleClick={() => edit?.open(v)}
                  onContextMenu={(e) => {
                    if (!edit) return;
                    e.preventDefault();
                    if (!edit.selection.has(v.id)) edit.select(v.id, "replace");
                    edit.context({ x: e.clientX, y: e.clientY }, v, day);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && edit) {
                      e.preventDefault();
                      edit.open(v);
                    }
                  }}
                  onClick={(e) => {
                    setActive([ci, r]);
                    if (edit) edit.select(v.id, e.shiftKey || e.ctrlKey || e.metaKey ? "toggle" : "replace");
                    else onSelect(v);
                  }}
                  onFocus={() => setActive([ci, r])}
                  className={cn(
                    "absolute left-1 right-1 truncate rounded border border-l-4 px-1.5 text-left text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    style.block,
                    v.roster_state === "draft" && DRAFT_CLASS,
                    (edit ? edit.selection.has(v.id) : v.id === selectedId) && "ring-2 ring-primary",
                    edit?.conflicts.get(v.id) && (hasBlocking(edit.conflicts.get(v.id)) ? "outline outline-2 outline-red-600" : "outline outline-2 outline-amber-500"),
                  )}
                  style={{ top: HEAD_H + r * CHIP_H + 1, height: CHIP_H - 3, lineHeight: `${CHIP_H - 5}px` }}
                >
                  {edit?.conflicts.get(v.id) && <b aria-hidden className="mr-1 text-red-600">!</b>}
                  <b>{formatLondonTime(v.start_time)}</b> {shortName(v.client_name)} · {carerNames(v)}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
