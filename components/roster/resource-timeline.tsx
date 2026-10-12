"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { formatLondonShortDate, formatLondonTime, londonMidnight, parseCalendarDate, addDays } from "@/lib/dates/london";
import { moveVisit, resizeVisit } from "@/lib/roster-ui/commands";
import { hasBlocking, type Conflict } from "@/lib/roster-ui/conflicts";
import { OPEN_ROW, type BlockedSpan } from "@/lib/roster-ui/group";
import { heatColor, pct } from "@/lib/roster-ui/ghost";
import { inWindow, packLanes, xOf } from "@/lib/roster-ui/layout";
import { msAt, snapMs } from "@/lib/roster-ui/snap";
import { DRAFT_CLASS, STATUS_STYLES } from "@/lib/roster-ui/status";
import type { VisitRow } from "@/lib/roster/types";
import { cn } from "@/lib/utils";
import { blockLabel, describeVisit } from "./format";
import type { DragPreview, GhostScores } from "./use-ghost-scores";

// Resource timeline: rows (carers or clients) down the side, real time across.
// Virtualized on BOTH axes: @tanstack/react-virtual windows the rows, and each row only renders the
// visits whose pixels fall inside the horizontal viewport (plus a buffer). About 100 rows x 1,000
// visits stays at a few hundred DOM nodes.
//
// Editing (Phase 3) is optional: pass `edit` and the grid becomes interactive via one pointer-gesture
// engine (move / resize / drag-to-create / lasso). The grid never saves anything itself; it reports
// intent through TimelineEdit and the editor hook does the optimistic update and saving.

export interface TimelineRow {
  id: string;
  label: string;
  sub?: string | null;
  hours?: { text: string; warn: boolean } | null;
}

export interface TimelineEdit {
  snap: number;
  selection: ReadonlySet<string>;
  conflicts: Map<string, Conflict[]>;
  select: (id: string, mode: "replace" | "toggle") => void;
  setSelection: (ids: string[]) => void;
  clearSelection: () => void;
  open: (v: VisitRow) => void;
  /** Move `ids` by `deltaMs`; `toRowId` is set when dropped on another row. */
  move: (ids: string[], deltaMs: number, toRowId: string | null, fromRowId: string) => void;
  resize: (id: string, edge: "start" | "end", ms: number) => void;
  create: (rowId: string, startMs: number, endMs: number, at: { x: number; y: number }) => void;
  context: (at: { x: number; y: number }, visit: VisitRow | null, rowId: string, ms: number) => void;
  dropTray: (visitId: string, rowId: string) => void;
  /** Conflicts a drafted placement would have on a carer's row. */
  preview: (draft: VisitRow, rowId: string, ignore: Set<string>) => Conflict[];
}

interface Props {
  rows: TimelineRow[];
  visitsByRow: Map<string, VisitRow[]>;
  blockedByRow?: Map<string, BlockedSpan[]>;
  rangeStart: Date;
  rangeEnd: Date;
  days: string[];
  pxPerHour: number;
  /** What a block shows: the client (carer rows) or the carers (client rows). */
  labelMode: "client" | "carer";
  rowHeader: string;
  ariaLabel: string;
  selectedId: string | null;
  onSelect: (v: VisitRow) => void;
  now: Date;
  emptyText: string;
  edit?: TimelineEdit;
  /** Match scores for the visit being dragged (carer rows only): tints each row, greys filtered carers. */
  ghost?: GhostScores | null;
  /** Reports what a drag would produce (visit + time) so the parent can fetch `ghost`; null when the drag ends. */
  onDragPreview?: (preview: DragPreview | null) => void;
}

const LABEL_W = 184;
const HEAD_H = 52;
const LANE_H = 26;
const PAD = 5;
const MIN_BLOCK_W = 16;
const BUFFER_PX = 500;
const DRAG_THRESHOLD = 4;
const HANDLE_W = 6;
const EDGE_SCROLL = 24; // px from the edge of the visible rows / axis area that triggers auto-scroll
const DEFAULT_MS = 60 * 60_000;

type Ui =
  | { kind: "move"; ids: string[]; primary: string; fromRow: string; deltaMs: number; rowId: string; px: number; py: number }
  | { kind: "resize"; id: string; edge: "start" | "end"; ms: number }
  | { kind: "create"; rowId: string; fromMs: number; toMs: number }
  | { kind: "lasso"; x0: number; y0: number; x1: number; y1: number };

const locked = (v: VisitRow) => v.actual_start != null || v.status === "in_progress" || v.status === "completed";

export function ResourceTimeline(p: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ left: 0, width: 1200 });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ui, setUi] = useState<Ui | null>(null);
  const uiRef = useRef<Ui | null>(null);
  const justDragged = useRef(false);
  const pendingFocus = useRef(false);
  const [dropRow, setDropRow] = useState<string | null>(null);
  const [dropPt, setDropPt] = useState<{ x: number; y: number } | null>(null);
  const edit = p.edit;
  const { ghost, onDragPreview } = p;
  const onPreviewRef = useRef(onDragPreview);
  useEffect(() => {
    onPreviewRef.current = onDragPreview;
  });

  const axisStart = p.rangeStart.getTime();
  const axisWidth = Math.round(xOf(p.rangeEnd.getTime(), axisStart, p.pxPerHour));

  // Per-row layout: lane packing and pixel boxes, computed once per data/zoom change.
  const layout = useMemo(
    () =>
      p.rows.map((row) => {
        const items = (p.visitsByRow.get(row.id) ?? []).map((v) => ({ v, start: Date.parse(v.start_time), end: Date.parse(v.end_time) }));
        const { placed, lanes } = packLanes(items);
        const boxes = placed
          .map(({ item, lane }) => {
            const left = xOf(item.start, axisStart, p.pxPerHour);
            const right = Math.max(xOf(item.end, axisStart, p.pxPerHour), left + MIN_BLOCK_W);
            return { v: item.v, lane, left, right };
          })
          .sort((a, b) => a.left - b.left);
        return { row, boxes, height: Math.max(1, lanes) * LANE_H + PAD * 2 };
      }),
    [p.rows, p.visitsByRow, axisStart, p.pxPerHour],
  );

  const tops = useMemo(() => {
    const t: number[] = [];
    let y = 0;
    for (const l of layout) {
      t.push(y);
      y += l.height;
    }
    return t;
  }, [layout]);

  const byId = useMemo(() => {
    const m = new Map<string, VisitRow>();
    for (const l of layout) for (const b of l.boxes) m.set(b.v.id, b.v);
    return m;
  }, [layout]);
  const rowsOf = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const l of layout) for (const b of l.boxes) m.set(b.v.id, [...(m.get(b.v.id) ?? []), l.row.id]);
    return m;
  }, [layout]);

  const virtualizer = useVirtualizer({
    count: layout.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => layout[i]?.height ?? LANE_H + PAD * 2,
    overscan: 6,
  });
  useLayoutEffect(() => virtualizer.measure(), [layout, virtualizer]);

  // Open at 06:00 (care calls start early) instead of midnight whenever the range or zoom changes.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = 6 * p.pxPerHour;
  }, [axisStart, p.pxPerHour]);

  // Track the horizontal viewport (throttled to animation frames).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      setView((prev) => (prev.left === el.scrollLeft && prev.width === el.clientWidth ? prev : { left: el.scrollLeft, width: el.clientWidth }));
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

  // ── keyboard model: one tab stop (the active block); arrows move between blocks ──
  const order = useMemo(() => layout.map((l) => l.boxes), [layout]);
  const where = useMemo(() => {
    const m = new Map<string, [number, number]>();
    order.forEach((boxes, r) => boxes.forEach((b, c) => m.set(b.v.id, [r, c])));
    return m;
  }, [order]);
  // The tab stop must always be a block that is actually rendered: the remembered one if it is
  // still in the window, otherwise the first rendered block.
  const virtualItems = virtualizer.getVirtualItems();
  const winLeft = view.left - BUFFER_PX;
  const winRight = view.left + view.width + BUFFER_PX;
  const rendered = (id: string | null) => {
    const pos = id ? where.get(id) : undefined;
    if (!pos) return false;
    const box = order[pos[0]][pos[1]];
    return virtualItems.some((vi) => vi.index === pos[0]) && box.right >= winLeft && box.left <= winRight;
  };
  const firstRendered = () => {
    for (const vi of virtualItems) {
      const hit = inWindow(order[vi.index] ?? [], winLeft, winRight)[0];
      if (hit) return hit.v.id;
    }
    return null;
  };
  const effectiveActive = rendered(activeId) ? activeId : firstRendered();

  const focusBlock = useCallback((id: string, r: number, c: number) => {
    setActiveId(id);
    pendingFocus.current = true;
    virtualizer.scrollToIndex(r, { align: "auto" });
    const box = order[r][c];
    const el = scrollRef.current;
    if (el) {
      const x = LABEL_W + box.left;
      if (x < el.scrollLeft + LABEL_W) el.scrollLeft = Math.max(0, x - LABEL_W - 40);
      else if (x + (box.right - box.left) > el.scrollLeft + el.clientWidth) el.scrollLeft = x + (box.right - box.left) - el.clientWidth + 40;
    }
  }, [order, virtualizer]);

  useEffect(() => {
    if (!pendingFocus.current || !activeId) return;
    // Wait until the target block has been rendered (the move may have scrolled it into the window).
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-visit-id="${activeId}"]`);
    if (el) {
      el.focus({ preventScroll: true });
      pendingFocus.current = false;
    }
  }, [activeId, virtualItems, view.left]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
    if (!keys.includes(e.key) || !effectiveActive) return;
    const pos = where.get(effectiveActive);
    if (!pos) return;
    const [r, c] = pos;
    e.preventDefault();
    const go = (rr: number, cc: number) => focusBlock(order[rr][cc].v.id, rr, cc);
    if (e.key === "ArrowLeft" && c > 0) go(r, c - 1);
    else if (e.key === "ArrowRight" && c < order[r].length - 1) go(r, c + 1);
    else if (e.key === "Home") go(r, 0);
    else if (e.key === "End") go(r, order[r].length - 1);
    else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const dir = e.key === "ArrowUp" ? -1 : 1;
      for (let rr = r + dir; rr >= 0 && rr < order.length; rr += dir) {
        if (!order[rr].length) continue;
        const target = order[r][c].left;
        let best = 0;
        order[rr].forEach((b, i) => {
          if (Math.abs(b.left - target) < Math.abs(order[rr][best].left - target)) best = i;
        });
        go(rr, best);
        break;
      }
    }
  };

  // ── pointer geometry (container-relative, so it is right while scrolled) ──
  const contentX = (clientX: number) => {
    const el = scrollRef.current!;
    return clientX - el.getBoundingClientRect().left + el.scrollLeft - LABEL_W;
  };
  const contentY = (clientY: number) => {
    const el = scrollRef.current!;
    return clientY - el.getBoundingClientRect().top + el.scrollTop - HEAD_H;
  };
  const msAtClient = (clientX: number) => msAt(contentX(clientX), axisStart, p.pxPerHour);
  const rowIndexAt = (y: number) => {
    let lo = 0;
    let hi = tops.length - 1;
    if (hi < 0) return -1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (tops[mid] <= y) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };

  const setGesture = (u: Ui | null) => {
    uiRef.current = u;
    setUi(u);
  };

  /** Run a pointer gesture until release (or Escape). `update` maps pointer position to UI state. */
  const gesture = (
    startEvent: { clientX: number; clientY: number },
    update: (e: { clientX: number; clientY: number }, moved: boolean) => Ui | null,
    finish: (ui: Ui | null, moved: boolean, e: { clientX: number; clientY: number }) => void,
  ) => {
    const el = scrollRef.current;
    if (!el) return;
    let moved = false;
    let last = { clientX: startEvent.clientX, clientY: startEvent.clientY };
    let raf = 0;
    const run = () => {
      const dx = last.clientX - startEvent.clientX;
      const dy = last.clientY - startEvent.clientY;
      if (!moved && Math.hypot(dx, dy) >= DRAG_THRESHOLD) moved = true;
      if (moved) setGesture(update(last, true));
    };
    // Edge auto-scroll so a visit can be dragged to another day.
    const tick = () => {
      const r = el.getBoundingClientRect();
      let s = false;
      if (moved) {
        if (last.clientX > r.right - EDGE_SCROLL) { el.scrollLeft += 16; s = true; }
        else if (last.clientX < r.left + LABEL_W + EDGE_SCROLL && el.scrollLeft > 0) { el.scrollLeft -= 16; s = true; }
        // Vertical: only when the pointer is at the very top of the rows (just under the sticky header) or the bottom.
        if (last.clientY > r.bottom - EDGE_SCROLL) { el.scrollTop += 12; s = true; }
        else if (last.clientY < r.top + HEAD_H + EDGE_SCROLL / 3 && el.scrollTop > 0) { el.scrollTop -= 12; s = true; }
      }
      if (s) run();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const move = (e: PointerEvent) => {
      last = { clientX: e.clientX, clientY: e.clientY };
      run();
    };
    const end = (cancel: boolean) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("keydown", key, true);
      cancelAnimationFrame(raf);
      const u = uiRef.current;
      setGesture(null);
      if (moved) {
        justDragged.current = true;
        setTimeout(() => (justDragged.current = false), 0);
      }
      if (!cancel) finish(u, moved, last);
    };
    const up = () => end(false);
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        end(true);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("keydown", key, true);
  };

  // ── gestures ──
  const startMove = (e: React.PointerEvent, v: VisitRow, rowId: string) => {
    if (!edit || e.button !== 0 || locked(v)) return;
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    const ids = edit.selection.has(v.id) && !additive ? [...edit.selection].filter((id) => byId.has(id) && !locked(byId.get(id)!)) : [v.id];
    const startMs = Date.parse(v.start_time);
    const x0 = contentX(e.clientX);
    gesture(
      e,
      (pt) => {
        const dx = contentX(pt.clientX) - x0; // includes any auto-scroll
        const raw = (dx / p.pxPerHour) * 3_600_000;
        const deltaMs = snapMs(startMs + raw, edit.snap) - startMs;
        const ri = rowIndexAt(contentY(pt.clientY));
        const rowId2 = ri >= 0 ? layout[ri].row.id : rowId;
        return { kind: "move", ids, primary: v.id, fromRow: rowId, deltaMs, rowId: rowId2, px: pt.clientX, py: pt.clientY };
      },
      (u, moved) => {
        if (!moved || !u || u.kind !== "move") return;
        const rowChanged = u.rowId !== u.fromRow;
        if (u.deltaMs === 0 && !rowChanged) return;
        edit.move(u.ids, u.deltaMs, rowChanged ? u.rowId : null, u.fromRow);
      },
    );
  };

  const startResize = (e: React.PointerEvent, v: VisitRow, edge: "start" | "end") => {
    if (!edit || e.button !== 0 || locked(v)) return;
    e.stopPropagation();
    e.preventDefault();
    gesture(
      e,
      (pt) => ({ kind: "resize", id: v.id, edge, ms: snapMs(msAtClient(pt.clientX), edit.snap) }),
      (u, moved) => {
        if (moved && u?.kind === "resize") edit.resize(v.id, edge, u.ms);
      },
    );
  };

  const startLane = (e: React.PointerEvent, rowId: string) => {
    if (!edit || e.button !== 0 || e.target !== e.currentTarget) return;
    if (rowId === OPEN_ROW) return;
    const anchor = snapMs(msAtClient(e.clientX), edit.snap);
    if (e.shiftKey) {
      const x0 = contentX(e.clientX);
      const y0 = contentY(e.clientY);
      gesture(
        e,
        (pt) => ({ kind: "lasso", x0, y0, x1: contentX(pt.clientX), y1: contentY(pt.clientY) }),
        (u) => {
          if (u?.kind !== "lasso") return;
          const [xa, xb] = [Math.min(u.x0, u.x1), Math.max(u.x0, u.x1)];
          const [ya, yb] = [Math.min(u.y0, u.y1), Math.max(u.y0, u.y1)];
          const hit: string[] = [];
          layout.forEach((l, r) => {
            if (tops[r] + l.height < ya || tops[r] > yb) return;
            for (const b of l.boxes) {
              const top = tops[r] + PAD + b.lane * LANE_H;
              if (b.right >= xa && b.left <= xb && top + LANE_H >= ya && top <= yb) hit.push(b.v.id);
            }
          });
          edit.setSelection(hit);
        },
      );
      return;
    }
    gesture(
      e,
      (pt) => {
        const to = snapMs(msAtClient(pt.clientX), edit.snap);
        return { kind: "create", rowId, fromMs: Math.min(anchor, to), toMs: Math.max(anchor, to) };
      },
      (u, moved, pt) => {
        if (!moved) {
          // a plain click on empty space: clear selection, and open quick-create with a 1h default
          edit.clearSelection();
          edit.create(rowId, anchor, anchor + DEFAULT_MS, { x: pt.clientX, y: pt.clientY });
        } else if (u?.kind === "create") {
          const end = u.toMs > u.fromMs ? u.toMs : u.fromMs + edit.snap * 60_000;
          edit.create(rowId, u.fromMs, end, { x: pt.clientX, y: pt.clientY });
        }
      },
    );
  };

  // ── ghosts (what the drop would produce) ──
  const ghosts = useMemo(() => {
    if (!edit || !ui) return [];
    const out: { key: string; rowId: string; left: number; width: number; label: string; level: "ok" | "warn" | "bad" }[] = [];
    const add = (key: string, d: VisitRow, rowId: string) => {
      const left = xOf(Date.parse(d.start_time), axisStart, p.pxPerHour);
      const right = xOf(Date.parse(d.end_time), axisStart, p.pxPerHour);
      const c = rowId === OPEN_ROW || p.labelMode !== "client" ? [] : edit.preview(d, rowId, new Set(ui.kind === "move" ? ui.ids : [d.id]));
      out.push({ key, rowId, left, width: Math.max(right - left, MIN_BLOCK_W), label: `${formatLondonTime(d.start_time)}–${formatLondonTime(d.end_time)}`, level: hasBlocking(c) ? "bad" : c.length ? "warn" : "ok" });
    };
    if (ui.kind === "move") {
      for (const id of ui.ids) {
        const v = byId.get(id);
        if (!v) continue;
        const d = moveVisit(v, { deltaMs: ui.deltaMs });
        const rows = ui.rowId !== ui.fromRow ? [ui.rowId] : (rowsOf.get(id) ?? []);
        rows.forEach((r) => add(`${id}:${r}`, d, r));
      }
    } else if (ui.kind === "resize") {
      const v = byId.get(ui.id);
      if (v) (rowsOf.get(ui.id) ?? []).forEach((r) => add(`${ui.id}:${r}`, resizeVisit(v, ui.edge, ui.ms, edit.snap), r));
    } else if (ui.kind === "create") {
      const stub = { id: "new", start_time: new Date(ui.fromMs).toISOString(), end_time: new Date(Math.max(ui.toMs, ui.fromMs + edit.snap * 60_000)).toISOString(), status: "assigned", carers: [], required_carers: 1, required_skills: [] } as unknown as VisitRow;
      add("create", stub, ui.rowId);
    }
    return out;
  }, [ui, edit, byId, rowsOf, axisStart, p.pxPerHour, p.labelMode]);

  // Tell the parent what a move would produce (visit + snapped time + source carer) so it can fetch match
  // scores. Keyed on primitives, so moving across rows does not re-report; only a new time slot does.
  const mv = edit && p.labelMode === "client" && ui?.kind === "move" ? ui : null;
  const mvVisit = mv ? byId.get(mv.primary) : undefined;
  const mvStart = mvVisit && mv ? Date.parse(mvVisit.start_time) + mv.deltaMs : null;
  const mvEnd = mvVisit && mv ? Date.parse(mvVisit.end_time) + mv.deltaMs : null;
  const mvId = mvVisit?.id ?? null;
  const mvFrom = mv && mv.fromRow !== OPEN_ROW ? mv.fromRow : null;
  useEffect(() => {
    if (!mvId || mvStart === null || mvEnd === null) return;
    onPreviewRef.current?.({ visitId: mvId, startIso: new Date(mvStart).toISOString(), endIso: new Date(mvEnd).toISOString(), fromCarer: mvFrom });
    return () => onPreviewRef.current?.(null);
  }, [mvId, mvStart, mvEnd, mvFrom]);

  const ghostRow = mv ? mv.rowId : dropRow;
  const ghostCell = ghost && p.labelMode === "client" && ghostRow && ghostRow !== OPEN_ROW ? ghost.scores[ghostRow] : undefined;
  const ghostPt = mv ? { x: mv.px, y: mv.py } : dropPt;

  const dragging = new Set(ui?.kind === "move" ? ui.ids : ui?.kind === "resize" ? [ui.id] : []);

  // Header: one cell per day plus hour ticks, both from real instants (so 23/25-hour days are right).
  const dayCells = useMemo(() => {
    return p.days.map((d) => {
      const c = parseCalendarDate(d);
      const s = londonMidnight(c).getTime();
      const e = londonMidnight(addDays(c, 1)).getTime();
      return { d, left: xOf(s, axisStart, p.pxPerHour), width: xOf(e, axisStart, p.pxPerHour) - xOf(s, axisStart, p.pxPerHour), label: formatLondonShortDate(new Date(s).toISOString()) };
    });
  }, [p.days, axisStart, p.pxPerHour]);

  const tickEvery = p.pxPerHour >= 28 ? 1 : p.pxPerHour >= 14 ? 3 : 6;
  const ticks = useMemo(() => {
    const out: { left: number; label: string }[] = [];
    for (let t = axisStart; t < p.rangeEnd.getTime(); t += tickEvery * 3_600_000) {
      out.push({ left: xOf(t, axisStart, p.pxPerHour), label: formatLondonTime(new Date(t).toISOString()) });
    }
    return out;
  }, [axisStart, p.rangeEnd, p.pxPerHour, tickEvery]);

  const nowX = xOf(p.now.getTime(), axisStart, p.pxPerHour);
  const totalHeight = virtualizer.getTotalSize();

  if (p.rows.length === 0) {
    return <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">{p.emptyText}</div>;
  }

  const isSelected = (id: string) => (edit ? edit.selection.has(id) : id === p.selectedId);

  return (
    <div
      ref={scrollRef}
      role="grid"
      aria-label={p.ariaLabel}
      aria-rowcount={layout.length}
      aria-multiselectable={edit ? true : undefined}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className={cn("relative h-full overflow-auto overscroll-contain rounded-xl border bg-background", ui && "select-none", ui?.kind === "move" && "cursor-grabbing")}
    >
      <div className="relative" style={{ width: LABEL_W + axisWidth, height: HEAD_H + totalHeight }}>
        {/* header */}
        <div className="sticky top-0 z-30 flex border-b bg-background" style={{ height: HEAD_H, width: LABEL_W + axisWidth }}>
          <div className="sticky left-0 z-40 flex shrink-0 items-end border-r bg-background px-3 pb-1.5 text-xs font-medium text-muted-foreground" style={{ width: LABEL_W }}>
            {p.rowHeader}
          </div>
          <div className="relative shrink-0" style={{ width: axisWidth }} aria-hidden>
            {dayCells.map((c) => (
              <div key={c.d} className="absolute top-0 h-6 truncate border-l px-2 text-xs font-semibold leading-6" style={{ left: c.left, width: c.width }}>
                {c.label}
              </div>
            ))}
            {ticks.map((t, i) => (
              <div key={i} className="absolute top-6 h-[26px] border-l pl-1 text-[10px] leading-[26px] text-muted-foreground" style={{ left: t.left }}>
                {t.label}
              </div>
            ))}
          </div>
        </div>

        {/* day separators and now marker, behind the rows */}
        <div className="pointer-events-none absolute z-0" style={{ left: LABEL_W, top: HEAD_H, width: axisWidth, height: totalHeight }} aria-hidden>
          {dayCells.map((c) => (
            <div key={c.d} className="absolute inset-y-0 border-l border-border" style={{ left: c.left }} />
          ))}
          {nowX >= 0 && nowX <= axisWidth && <div className="absolute inset-y-0 z-10 w-0.5 bg-red-500" style={{ left: nowX }} />}
        </div>

        {/* lasso rectangle */}
        {ui?.kind === "lasso" && (
          <div
            aria-hidden
            className="pointer-events-none absolute z-40 border border-primary bg-primary/10"
            style={{ left: LABEL_W + Math.min(ui.x0, ui.x1), top: HEAD_H + Math.min(ui.y0, ui.y1), width: Math.abs(ui.x1 - ui.x0), height: Math.abs(ui.y1 - ui.y0) }}
          />
        )}

        {ghostCell && ghostPt && (
          <div
            role="status"
            className={cn(
              "pointer-events-none fixed z-[80] max-w-[260px] rounded-lg border px-2 py-1 text-[11px] leading-snug shadow-lg",
              ghostCell.excluded ? "bg-muted text-muted-foreground" : "bg-popover text-popover-foreground",
            )}
            style={{ left: ghostPt.x + 14, top: ghostPt.y + 14 }}
          >
            {ghostCell.excluded ? (
              <b>{ghostCell.reason}</b>
            ) : (
              <>
                <b className="tabular-nums">{pct(ghostCell.total)}</b>
                {ghostCell.reason ? ` · ${ghostCell.reason}` : ""}
                {ghostCell.warnings[0] && <span className="block text-amber-700 dark:text-amber-300">{ghostCell.warnings[0]}</span>}
              </>
            )}
          </div>
        )}

        {virtualItems.map((vi) => {
          const { row, boxes, height } = layout[vi.index];
          const blocked = (p.blockedByRow?.get(row.id) ?? []).filter((b) => {
            const l = xOf(b.start, axisStart, p.pxPerHour);
            const r = xOf(b.end, axisStart, p.pxPerHour);
            return r >= winLeft && l <= winRight;
          });
          const rowGhosts = ghosts.filter((g) => g.rowId === row.id);
          const isDrop = (ui?.kind === "move" && ui.rowId === row.id && ui.rowId !== ui.fromRow) || dropRow === row.id;
          const cell = ghost && p.labelMode === "client" && row.id !== OPEN_ROW ? ghost.scores[row.id] : undefined;
          return (
            <div
              key={row.id}
              role="row"
              aria-rowindex={vi.index + 1}
              className="absolute left-0 flex border-b"
              style={{ top: HEAD_H + vi.start, height, width: LABEL_W + axisWidth }}
            >
              <div
                role="rowheader"
                className={cn("sticky left-0 z-20 flex shrink-0 flex-col justify-center border-r bg-background px-3", isDrop && "bg-primary/10", cell?.excluded && "text-muted-foreground")}
                style={{ width: LABEL_W }}
                title={cell ? (cell.excluded ? cell.message : [cell.reason, ...cell.warnings].filter(Boolean).join("\n")) : undefined}
              >
                {cell && (
                  <span
                    aria-label={cell.excluded ? `Not available: ${cell.reason}` : `${pct(cell.total)} match`}
                    className={cn(
                      "absolute right-1.5 top-1 rounded px-1 text-[10px] font-semibold tabular-nums",
                      cell.excluded ? "bg-muted text-muted-foreground" : "text-foreground",
                    )}
                    style={cell.excluded ? undefined : { backgroundColor: heatColor(cell.total, ghost?.stale ? 0.25 : 0.55) }}
                  >
                    {cell.excluded ? cell.reason : pct(cell.total)}
                  </span>
                )}
                <span className={cn("truncate text-xs font-semibold", cell?.excluded && "opacity-60")}>{row.label}</span>
                {row.sub && <span className="truncate text-[10px] text-muted-foreground">{row.sub}</span>}
                {row.hours && (
                  <span className={cn("truncate text-[10px]", row.hours.warn ? "font-semibold text-red-600 dark:text-red-400" : "text-muted-foreground")}>
                    {row.hours.text}
                  </span>
                )}
              </div>
              <div
                className={cn("relative shrink-0", isDrop && "bg-primary/5", edit && row.id !== OPEN_ROW && "cursor-crosshair")}
                data-row-id={row.id}
                style={{
                  width: axisWidth,
                  backgroundImage: "linear-gradient(to right, rgba(148,163,184,.22) 1px, transparent 1px)",
                  backgroundSize: `${p.pxPerHour}px 100%`,
                }}
                onPointerDown={(e) => startLane(e, row.id)}
                onContextMenu={(e) => {
                  if (!edit) return;
                  e.preventDefault();
                  edit.context({ x: e.clientX, y: e.clientY }, null, row.id, snapMs(msAtClient(e.clientX), edit.snap));
                }}
                onDragOver={(e) => {
                  if (edit && row.id !== OPEN_ROW && e.dataTransfer.types.includes("application/x-roster-visit")) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setDropRow(row.id);
                    // Throttled: dragover fires continuously, the chip only needs to be roughly under the pointer.
                    setDropPt((pt) => (pt && Math.abs(pt.x - e.clientX) < 8 && Math.abs(pt.y - e.clientY) < 8 ? pt : { x: e.clientX, y: e.clientY }));
                  }
                }}
                onDragLeave={() => setDropRow((r) => (r === row.id ? null : r))}
                onDrop={(e) => {
                  setDropRow(null);
                  setDropPt(null);
                  const id = e.dataTransfer.getData("application/x-roster-visit");
                  if (edit && id && row.id !== OPEN_ROW) {
                    e.preventDefault();
                    edit.dropTray(id, row.id);
                  }
                }}
              >
                {cell && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 z-0"
                    style={
                      cell.excluded
                        ? { backgroundImage: "repeating-linear-gradient(135deg, rgba(100,116,139,.28) 0 6px, rgba(100,116,139,.12) 6px 12px)" }
                        : { backgroundColor: heatColor(cell.total, ghost?.stale ? 0.1 : 0.22) }
                    }
                  />
                )}
                {blocked.map((b, i) => {
                  const l = xOf(b.start, axisStart, p.pxPerHour);
                  return (
                    <div
                      key={i}
                      role="img"
                      aria-label={`${row.label}: ${b.label}`}
                      title={b.label}
                      className={cn("pointer-events-none absolute inset-y-0 z-[1]", b.tentative && "outline-dashed outline-1 outline-slate-400")}
                      style={{
                        left: l,
                        width: Math.max(2, xOf(b.end, axisStart, p.pxPerHour) - l),
                        backgroundImage: `repeating-linear-gradient(45deg, rgba(100,116,139,${b.tentative ? 0.25 : 0.45}) 0 4px, transparent 4px 8px)`,
                      }}
                    />
                  );
                })}
                {inWindow(boxes, winLeft, winRight).map((b) => {
                  const style = STATUS_STYLES[b.v.status];
                  const cs = edit?.conflicts.get(b.v.id);
                  const bad = hasBlocking(cs);
                  const width = b.right - b.left;
                  const canEdit = !!edit && !locked(b.v);
                  return (
                    <button
                      key={b.v.id}
                      type="button"
                      role="gridcell"
                      data-visit-id={b.v.id}
                      tabIndex={b.v.id === effectiveActive ? 0 : -1}
                      aria-label={`${describeVisit(b.v)}${cs?.length ? `. Conflicts: ${cs.map((c) => c.message).join("; ")}` : ""}`}
                      aria-selected={isSelected(b.v.id)}
                      title={cs?.length ? cs.map((c) => c.message).join("\n") : describeVisit(b.v)}
                      onPointerDown={(e) => canEdit && startMove(e, b.v, row.id)}
                      onClick={(e) => {
                        if (justDragged.current) return;
                        setActiveId(b.v.id);
                        if (edit) edit.select(b.v.id, e.shiftKey || e.ctrlKey || e.metaKey ? "toggle" : "replace");
                        else p.onSelect(b.v);
                      }}
                      onDoubleClick={() => edit?.open(b.v)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && edit) {
                          e.preventDefault();
                          edit.open(b.v);
                        }
                      }}
                      onContextMenu={(e) => {
                        if (!edit) return;
                        e.preventDefault();
                        e.stopPropagation();
                        if (!edit.selection.has(b.v.id)) edit.select(b.v.id, "replace");
                        edit.context({ x: e.clientX, y: e.clientY }, b.v, row.id, Date.parse(b.v.start_time));
                      }}
                      onFocus={() => setActiveId(b.v.id)}
                      className={cn(
                        "absolute z-[2] overflow-hidden whitespace-nowrap rounded border border-l-4 px-1 text-left text-[11px] leading-[22px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                        style.block,
                        b.v.roster_state === "draft" && DRAFT_CLASS,
                        isSelected(b.v.id) && "ring-2 ring-primary",
                        cs?.length && (bad ? "outline outline-2 outline-red-600" : "outline outline-2 outline-amber-500"),
                        canEdit && "cursor-grab touch-none",
                        dragging.has(b.v.id) && "opacity-40",
                      )}
                      style={{ left: b.left, width, top: PAD + b.lane * LANE_H, height: LANE_H - 4 }}
                    >
                      {cs?.length ? <span aria-hidden className={cn("mr-1 font-bold", bad ? "text-red-600" : "text-amber-600")}>!</span> : null}
                      {blockLabel(b.v, p.labelMode)}
                      {canEdit && width > 28 && (
                        <>
                          <span aria-hidden onPointerDown={(e) => startResize(e, b.v, "start")} className="absolute inset-y-0 left-0 cursor-ew-resize" style={{ width: HANDLE_W }} />
                          <span aria-hidden onPointerDown={(e) => startResize(e, b.v, "end")} className="absolute inset-y-0 right-0 cursor-ew-resize" style={{ width: HANDLE_W }} />
                        </>
                      )}
                    </button>
                  );
                })}
                {rowGhosts.map((g) => (
                  <div
                    key={g.key}
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute z-[3] rounded border-2 border-dashed px-1 text-[11px] font-medium leading-[20px]",
                      g.level === "ok" && "border-primary bg-primary/15 text-primary",
                      g.level === "warn" && "border-amber-500 bg-amber-500/20 text-amber-700 dark:text-amber-300",
                      g.level === "bad" && "border-red-600 bg-red-600/20 text-red-700 dark:text-red-300",
                    )}
                    style={{ left: g.left, width: g.width, top: PAD, height: LANE_H - 4 }}
                  >
                    {g.label}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
