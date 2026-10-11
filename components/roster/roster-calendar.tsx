"use client";

/**
 * ROSTER CALENDAR (Phase 3, editable).
 *
 * LIBRARY DECISION (later phases: follow this, do not swap libraries without re-checking the numbers):
 *   FullCalendar was rejected. Its resource-timeline is a paid premium plugin, it renders every row
 *   and event into the DOM (no virtualization, so ~100 carers x a week gets janky), and it is hard
 *   to theme with our Tailwind/shadcn tokens.
 *   CHOSEN: custom CSS grids + @tanstack/react-virtual (headless, free, windows rows AND columns).
 *   Phase 3 drag-and-drop: one pointer-gesture engine inside resource-timeline.tsx (move, resize,
 *   create, lasso, edge auto-scroll; it must share the virtualizer's coordinates, which a generic
 *   DnD library would not know about) plus native HTML5 drag-and-drop for tray -> row and week-board
 *   -> day. No extra dependency.
 *
 * Shape: all data for the visible week (or month) is fetched once and filtered in memory, so filter
 * changes and switching between Day / Week / Timeline / Clients are instant. State (view, date,
 * filters, search, zoom, snap) lives in the URL and in localStorage (lib/roster-ui/state.ts).
 *
 * Editing: this component builds RosterCommands; use-roster-editor.ts applies them optimistically,
 * saves them in order, reconciles with the server and keeps undo/redo.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { addDays, dayNumber, londonDateOf, londonMidnight, londonParts, londonWallClockToInstant, parseCalendarDate } from "@/lib/dates/london";
import { fetchCarers, fetchClients, fetchSkills, fetchVisits, invalidate } from "@/lib/roster-ui/api";
import { cmd, dayShiftMs, moveVisit, reassign, resizeVisit, unassign, type CarerRef } from "@/lib/roster-ui/commands";
import { carerConflicts, detectConflicts } from "@/lib/roster-ui/conflicts";
import { activeFilterCount, filterVisits, visibleCarers, type Filters } from "@/lib/roster-ui/filter";
import { OPEN_ROW, blockedSpans, groupByCarer, groupByClient, groupByDay, overlapping, type BlockedSpan } from "@/lib/roster-ui/group";
import { carerHours, formatHours } from "@/lib/roster-ui/hours";
import { rangeFor, stepDate } from "@/lib/roster-ui/range";
import { STORAGE_KEY, ZOOM_PX, initialState, serializeState, type RosterState, type Zoom } from "@/lib/roster-ui/state";
import { trayItems, type TrayItem } from "@/lib/roster-ui/tray";
import type { RosterCarer, RosterClient, RosterView } from "@/lib/roster-ui/types";
import type { VisitRow } from "@/lib/roster/types";
import { cn } from "@/lib/utils";
import { AgendaView } from "./agenda-view";
import { ContextMenu, type MenuItem } from "./context-menu";
import { Legend } from "./legend";
import { MonthView } from "./month-view";
import { OverrideDialog } from "./override-dialog";
import { PickDialog } from "./pick-dialog";
import { ResourceTimeline, type TimelineEdit, type TimelineRow } from "./resource-timeline";
import { Toolbar, type FilterOptions } from "./toolbar";
import { UnassignedTray } from "./unassigned-tray";
import { useRosterEditor } from "./use-roster-editor";
import { VisitForm, type FormDraft } from "./visit-form";
import { WeekBoard, type WeekEdit } from "./week-board";

const DAY_PX = 140; // pixels per hour in the single-day view (wide enough to read a 45-minute visit)
const HOUR = 3_600_000;

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

interface FormState {
  visit?: VisitRow;
  draft?: FormDraft;
  at: { x: number; y: number } | null;
}
interface MenuState {
  at: { x: number; y: number };
  visit: VisitRow | null;
  /** Where "paste here" / "new visit here" lands. */
  ms: number;
  carerId: string | null;
}
type Picker = { kind: "reassign" } | { kind: "duplicate" } | null;

const wallMs = (day: string, hour: number, minute = 0) => londonWallClockToInstant(parseCalendarDate(day), hour, minute).getTime();

export function RosterCalendar() {
  const [state, setState] = useState<RosterState | null>(null);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [carers, setCarers] = useState<RosterCarer[]>([]);
  const [clients, setClients] = useState<RosterClient[]>([]);
  const [skills, setSkills] = useState<{ code: string; name: string }[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [trayOpen, setTrayOpen] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [form, setForm] = useState<FormState | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [picker, setPicker] = useState<Picker>(null);
  const anchor = useRef<{ ms: number; carerId: string | null } | null>(null);
  const isMobile = useMediaQuery("(max-width: 767px)");

  const refresh = useCallback(() => {
    invalidate();
    setReload((n) => n + 1);
  }, []);

  const editor = useRosterEditor({ visits, setVisits, carers, snap: state?.snap ?? 15, reload: refresh });
  const { seed } = editor;

  // Restore state from the URL / last session after mount (not during render: avoids hydration mismatch).
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      /* storage blocked: fine */
    }
    setState(initialState(window.location.search, saved));
    setTrayOpen(window.matchMedia("(min-width: 1024px)").matches);
  }, []);

  // Persist: URL (shareable) + localStorage (remembers last view and filters).
  useEffect(() => {
    if (!state) return;
    const qs = serializeState(state).toString();
    window.history.replaceState(null, "", `?${qs}`);
    try {
      window.localStorage.setItem(STORAGE_KEY, qs);
    } catch {
      /* ignore */
    }
  }, [state]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Toasts clear themselves.
  const toastText = editor.toast?.text;
  const { dismissToast } = editor;
  useEffect(() => {
    if (!toastText) return;
    const t = setTimeout(dismissToast, 6000);
    return () => clearTimeout(t);
  }, [toastText, dismissToast]);

  // Day / Week / Timeline / Clients all read the same Monday-Sunday week, so switching between them
  // is instant; only Month loads a different (42-day) range.
  const dataRange = useMemo(() => (state ? rangeFor(state.view === "month" ? "month" : "week", state.date) : null), [state]);
  const from = dataRange?.from;
  const to = dataRange?.to;

  useEffect(() => {
    if (!from || !to) return;
    let cancelled = false;
    setStatus("loading");
    Promise.all([fetchVisits(from, to), fetchCarers(from, to)])
      .then(([v, c]) => {
        if (cancelled) return;
        seed(v);
        setVisits(v);
        setCarers(c);
        setStatus("ready");
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message);
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [from, to, reload, seed]);

  useEffect(() => {
    fetchClients().then(setClients).catch(() => {});
    fetchSkills().then(setSkills).catch(() => {});
  }, []);

  const update = useCallback((patch: Partial<RosterState>) => setState((s) => (s ? { ...s, ...patch } : s)), []);
  const setView = useCallback((view: RosterView) => update({ view }), [update]);
  const step = useCallback((dir: 1 | -1) => setState((s) => (s ? { ...s, date: stepDate(s.view, s.date, dir) } : s)), []);
  const today = londonDateOf(now);

  // ── derived data ──
  const clientTeam = useMemo(() => new Map(clients.map((c) => [c.id, c.location_id])), [clients]);
  const filters: Filters | null = state?.filters ?? null;
  const filtered = useMemo(() => (filters ? filterVisits(visits, filters, { clientTeam }) : visits), [visits, filters, clientTeam]);
  const conflicts = useMemo(() => detectConflicts(visits, carers), [visits, carers]);
  const carerById = useMemo(() => new Map(carers.map((c) => [c.carer_id, c])), [carers]);
  const visitById = useMemo(() => new Map(visits.map((v) => [v.id, v])), [visits]);

  const options = useMemo<FilterOptions>(() => {
    const teams = new Map<string, string>();
    for (const c of carers) if (c.location_id && c.team) teams.set(c.location_id, c.team);
    for (const c of clients) if (c.location_id && c.team) teams.set(c.location_id, c.team);
    return {
      carers: carers.map((c) => ({ value: c.carer_id, label: c.full_name })),
      clients: clients.map((c) => ({ value: c.id, label: c.full_name })),
      teams: [...teams].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label)),
      skills: skills.map((s) => ({ value: s.code, label: s.name })),
    };
  }, [carers, clients, skills]);

  const tray = useMemo<TrayItem[]>(() => trayItems(filtered, now), [filtered, now]);

  const view = state?.view ?? "week";
  const anchorDate = state?.date ?? today;
  const viewRange = useMemo(() => rangeFor(view, anchorDate), [view, anchorDate]);
  const weekRange = useMemo(() => rangeFor("week", anchorDate), [anchorDate]);

  const dayVisits = useMemo(() => overlapping(filtered, viewRange.start.getTime(), viewRange.end.getTime()), [filtered, viewRange]);

  // Carer rows (Day / Timeline): hours use the UNFILTERED visits so totals stay true when filtering.
  const carerRows = useMemo(() => {
    if (!state) return { rows: [] as TimelineRow[], by: new Map<string, VisitRow[]>(), blocked: new Map<string, BlockedSpan[]>() };
    const dayStart = londonMidnight(parseCalendarDate(anchorDate)).getTime();
    const dayEnd = londonMidnight(addDays(parseCalendarDate(anchorDate), 1)).getTime();
    const hours = carerHours(visits, { start: dayStart, end: dayEnd }, { start: weekRange.start.getTime(), end: weekRange.end.getTime() });
    const by = groupByCarer(dayVisits);
    const people = visibleCarers(carers, filtered, state.filters);
    const rows: TimelineRow[] = [];
    // The Unassigned row is always present when editing, so a visit can be dragged back onto it.
    rows.push({ id: OPEN_ROW, label: "Unassigned", sub: `${by.get(OPEN_ROW)?.length ?? 0} visits need a carer` });
    const blocked = new Map<string, BlockedSpan[]>();
    for (const c of people) {
      const h = hours.get(c.carer_id) ?? { day: 0, week: 0 };
      const cap = c.max_weekly_hours;
      rows.push({
        id: c.carer_id,
        label: c.full_name,
        sub: c.team,
        hours: { text: `${formatHours(h.day)} today · ${formatHours(h.week)} wk${cap ? ` / ${cap}h` : ""}`, warn: !!cap && h.week > cap },
      });
      blocked.set(c.carer_id, blockedSpans(c));
    }
    return { rows, by, blocked };
  }, [state, visits, carers, filtered, dayVisits, anchorDate, weekRange]);

  const clientRows = useMemo(() => {
    if (!state) return { rows: [] as TimelineRow[], by: new Map<string, VisitRow[]>() };
    const by = groupByClient(filtered);
    const narrowed = activeFilterCount(state.filters) > 0;
    const list = narrowed ? clients.filter((c) => by.has(c.id)) : clients;
    return { rows: list.map((c) => ({ id: c.id, label: c.full_name, sub: c.team ?? c.postcode })), by };
  }, [state, filtered, clients]);

  const byDay = useMemo(() => groupByDay(filtered), [filtered]);

  const pickDay = useCallback((day: string) => setState((s) => (s ? { ...s, view: "day", date: day } : s)), []);

  // ── actions ──
  const snap = state?.snap ?? 15;
  const refOf = (id: string | null | undefined): CarerRef | undefined => {
    const c = id ? carerById.get(id) : undefined;
    return c ? { carer_id: c.carer_id, full_name: c.full_name } : undefined;
  };
  const selectedRows = () => visits.filter((v) => editor.selection.has(v.id));

  const openNew = (draft: FormDraft, at: { x: number; y: number } | null) => setForm({ draft, at });
  const newHere = (ms: number, carerId: string | null, at: { x: number; y: number } | null) =>
    openNew({ carerId, startMs: ms, endMs: ms + HOUR }, at);

  const act = editor.act;
  const moveRows = (ids: string[], shiftFor: (v: VisitRow) => number, to: CarerRef | null | undefined, from: string | undefined, label: string) => {
    const before = ids.map((id) => visitById.get(id)).filter((v): v is VisitRow => !!v);
    if (before.length === 0) return;
    const after = before.map((v) => {
      let out = moveVisit(v, { deltaMs: shiftFor(v) });
      if (to) out = reassign(out, to, from && out.carers.some((c) => c.carer_id === from) ? from : undefined);
      else if (to === null && from) out = unassign(out, from);
      return out;
    });
    void act(cmd(before.length > 1 ? `${label} (${before.length} visits)` : label, before, after));
  };

  const timelineEdit: TimelineEdit | undefined = !isMobile && (view === "day" || view === "timeline")
    ? {
        snap,
        selection: editor.selection,
        conflicts,
        select: editor.select,
        setSelection: (ids) => editor.setSelection(new Set(ids)),
        clearSelection: editor.clearSelection,
        open: (v) => setForm({ visit: v, at: null }),
        move: (ids, deltaMs, toRowId, fromRowId) => {
          const from = fromRowId === OPEN_ROW ? undefined : fromRowId;
          if (toRowId === null) return moveRows(ids, () => deltaMs, undefined, from, "Move visit");
          if (toRowId === OPEN_ROW) return moveRows(ids, () => deltaMs, null, from, "Unassign visit");
          const to = refOf(toRowId);
          moveRows(ids, () => deltaMs, to, from, `Move to ${to?.full_name ?? "carer"}`);
        },
        resize: (id, edge, ms) => {
          const v = visitById.get(id);
          if (v) void act(cmd("Resize visit", [v], [resizeVisit(v, edge, ms, snap)]));
        },
        create: (rowId, startMs, endMs, at) => {
          anchor.current = { ms: startMs, carerId: rowId };
          openNew({ carerId: rowId, startMs, endMs }, at);
        },
        context: (at, visit, rowId, ms) => {
          anchor.current = { ms, carerId: rowId === OPEN_ROW ? null : rowId };
          setMenu({ at, visit, ms, carerId: rowId === OPEN_ROW ? null : rowId });
        },
        dropTray: (visitId, rowId) => {
          const v = visitById.get(visitId);
          const to = refOf(rowId);
          if (!v || !to) return;
          void act(cmd(`Assign to ${to.full_name}`, [v], [reassign(v, to)]));
        },
        preview: (draft, rowId, ignore) => {
          const c = carerById.get(rowId);
          if (!c) return [];
          const others = visits.filter((v) => !ignore.has(v.id) && v.carers.some((k) => k.carer_id === rowId));
          return carerConflicts(draft, c, others);
        },
      }
    : undefined;

  const weekEdit: WeekEdit | undefined = !isMobile && view === "week"
    ? {
        selection: editor.selection,
        conflicts,
        select: editor.select,
        open: (v) => setForm({ visit: v, at: null }),
        moveToDay: (ids, day) =>
          moveRows(ids, (v) => {
            const p = londonParts(new Date(v.start_time));
            return wallMs(day, p.hour, p.minute) - Date.parse(v.start_time);
          }, undefined, undefined, "Move to another day"),
        create: (day, at) => {
          anchor.current = { ms: wallMs(day, 9), carerId: null };
          openNew({ carerId: null, startMs: wallMs(day, 9), endMs: wallMs(day, 10) }, at);
        },
        context: (at, visit, day) => {
          anchor.current = { ms: wallMs(day, 9), carerId: null };
          setMenu({ at, visit, ms: wallMs(day, 9), carerId: null });
        },
      }
    : undefined;
  const editable = !!(timelineEdit || weekEdit);

  const pasteHere = useCallback(
    (ms?: number, carerId?: string | null) => {
      if (editor.clipboard.length === 0) return editor.notify("Nothing copied yet. Select visits and press Ctrl+C.");
      const a = anchor.current;
      const first = Date.parse(editor.clipboard[0].start_time);
      const at = ms ?? a?.ms ?? first + dayShiftMs(editor.clipboard[0].start_time, 1);
      editor.paste(at, refOf(carerId === undefined ? a?.carerId : carerId));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor.clipboard, editor.paste, carerById],
  );

  // Previous week = the 7 London days before the visible Monday.
  const prevWeekBounds = () => {
    const start = londonMidnight(addDays(parseCalendarDate(weekRange.days[0]), -7)).getTime();
    return [start, weekRange.start.getTime()] as const;
  };

  // Keyboard shortcuts (ignored while typing in a field or a dialog is open).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [role=dialog], [role=alertdialog], [role=menu]")) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && !e.altKey) {
        if (!editable) return;
        const hasSel = editor.selection.size > 0;
        const handled = k === "z" || k === "y" || (k === "c" && hasSel) || k === "v" || (k === "d" && hasSel);
        if (!handled) return;
        e.preventDefault();
        if (k === "z") {
          if (e.shiftKey) editor.redo();
          else editor.undo();
        } else if (k === "y") editor.redo();
        else if (k === "c") editor.copy();
        else if (k === "v") pasteHere();
        else editor.duplicateSelected([1]);
        return;
      }
      if (e.altKey) return;
      if (editable && (e.key === "Delete" || e.key === "Backspace") && editor.selection.size > 0) {
        e.preventDefault();
        editor.deleteSelected();
        return;
      }
      if (editable && e.key === "Escape") return editor.clearSelection();
      if (editable && k === "n") {
        e.preventDefault();
        return newHere(wallMs(anchorDate, 9), null, null);
      }
      const views: Record<string, RosterView> = { d: "day", w: "week", m: "month", t: "timeline", c: "client" };
      if (views[k]) setView(views[k]);
      else if (e.key === "[") step(-1);
      else if (e.key === "]") step(1);
      else if (e.key === ".") update({ date: londonDateOf(new Date()) });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setView, step, update, editable, editor, pasteHere, anchorDate]);

  const onTray = useCallback(
    (item: TrayItem) => {
      editor.select(item.visit.id, "replace");
      const day = londonDateOf(new Date(item.visit.start_time));
      if (state && !viewRange.days.includes(day)) update({ date: day });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, viewRange, update, editor.select],
  );

  // ── context menu ──
  const menuItems = (m: MenuState): MenuItem[] => {
    const sel = selectedRows();
    const n = sel.length;
    const items: MenuItem[] = [];
    if (m.visit) {
      const v = m.visit;
      items.push({ label: v.series_id ? "Edit… (this or series)" : "Edit…", onSelect: () => setForm({ visit: v, at: null }) });
      items.push({ label: n > 1 ? `Copy ${n} visits` : "Copy", hint: "Ctrl+C", onSelect: editor.copy });
      items.push({ label: "Paste here", hint: "Ctrl+V", disabled: editor.clipboard.length === 0, onSelect: () => pasteHere(m.ms, m.carerId) });
      items.push({ label: "Duplicate to next day", hint: "Ctrl+D", divider: true, onSelect: () => editor.duplicateSelected([1]) });
      items.push({ label: "Duplicate to other days…", onSelect: () => setPicker({ kind: "duplicate" }) });
      items.push({ label: "Reassign…", divider: true, onSelect: () => setPicker({ kind: "reassign" }) });
      items.push({ label: "Unassign", disabled: !sel.some((x) => x.carers.length > 0), onSelect: editor.unassignSelected });
      items.push({ label: n > 1 ? `Delete ${n} visits` : "Delete", hint: "Del", danger: true, divider: true, onSelect: editor.deleteSelected });
    } else {
      items.push({ label: "New visit here…", onSelect: () => newHere(m.ms, m.carerId, m.at) });
      items.push({ label: "Paste here", hint: "Ctrl+V", disabled: editor.clipboard.length === 0, onSelect: () => pasteHere(m.ms, m.carerId) });
    }
    return items;
  };

  const duplicateOptions = useMemo(() => {
    const src = selectedRows()[0];
    const srcDay = src ? londonDateOf(new Date(src.start_time)) : anchorDate;
    const days: { value: string; label: string; disabled?: boolean }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = addDays(parseCalendarDate(weekRange.days[0]), i);
      const s = `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
      const diff = dayNumber(d) - dayNumber(parseCalendarDate(srcDay));
      days.push({ value: String(diff), label: new Date(`${s}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }), disabled: diff === 0 });
    }
    return days;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picker, weekRange, anchorDate]);

  if (!state || !filters) return <div className="h-[60vh] animate-pulse rounded-xl bg-muted" aria-busy="true" aria-label="Loading roster" />;

  const loading = status === "loading";
  const totalShown = filtered.length;
  const openDetail = (v: VisitRow) => setForm({ visit: v, at: null });
  const body = (() => {
    if (status === "error") {
      return (
        <div role="alert" className="flex h-full flex-col items-center justify-center gap-3 p-8 text-sm">
          <p>Could not load the roster: {error}</p>
          <button type="button" onClick={refresh} className="rounded-lg border px-3 py-1.5 hover:bg-accent">Try again</button>
        </div>
      );
    }
    if (isMobile && view !== "month") {
      const days = view === "day" ? viewRange.days : weekRange.days;
      return <AgendaView days={days} byDay={byDay} selectedId={null} onSelect={openDetail} />;
    }
    switch (view) {
      case "month":
        return <MonthView days={viewRange.days} month={Number(anchorDate.slice(5, 7))} byDay={byDay} today={today} onPickDay={pickDay} />;
      case "week":
        return <WeekBoard days={weekRange.days} byDay={byDay} today={today} selectedId={null} onSelect={openDetail} onPickDay={pickDay} edit={weekEdit} />;
      case "client":
        return (
          <ResourceTimeline
            rows={clientRows.rows}
            visitsByRow={clientRows.by}
            rangeStart={weekRange.start}
            rangeEnd={weekRange.end}
            days={weekRange.days}
            pxPerHour={ZOOM_PX[state.zoom]}
            labelMode="carer"
            rowHeader="Client"
            ariaLabel="Visits by client"
            selectedId={null}
            onSelect={openDetail}
            now={now}
            emptyText="No clients match."
          />
        );
      default: {
        const isDay = view === "day";
        const r = isDay ? viewRange : weekRange;
        return (
          <ResourceTimeline
            rows={carerRows.rows}
            visitsByRow={carerRows.by}
            blockedByRow={carerRows.blocked}
            rangeStart={r.start}
            rangeEnd={r.end}
            days={r.days}
            pxPerHour={isDay ? DAY_PX : ZOOM_PX[state.zoom]}
            labelMode="client"
            rowHeader="Carer"
            ariaLabel={isDay ? "Visits by carer for the day" : "Visits by carer for the week"}
            selectedId={null}
            onSelect={openDetail}
            now={now}
            emptyText="No carers match."
            edit={timelineEdit}
          />
        );
      }
    }
  })();

  const nSel = editor.selection.size;

  return (
    <div className="flex flex-col gap-3">
      <Toolbar
        state={state}
        options={options}
        trayCount={tray.length}
        trayOpen={trayOpen}
        loading={loading}
        showLegend={showLegend}
        onView={setView}
        onStep={step}
        onToday={() => update({ date: today })}
        onFilters={(f) => update({ filters: f })}
        onZoom={(zoom: Zoom) => update({ zoom })}
        onTray={() => setTrayOpen((o) => !o)}
        onLegend={() => setShowLegend((o) => !o)}
        onRefresh={refresh}
        edit={
          isMobile
            ? undefined
            : {
                canUndo: editor.canUndo,
                canRedo: editor.canRedo,
                undoLabel: editor.undoLabel,
                redoLabel: editor.redoLabel,
                saving: editor.saving,
                onUndo: editor.undo,
                onRedo: editor.redo,
                onSnap: (s) => update({ snap: s }),
                onNew: () => newHere(wallMs(anchorDate, 9), null, null),
                onCopyPrevWeek: () => {
                  const [a, b] = prevWeekBounds();
                  editor.copyPrevWeek(a, b);
                },
              }
        }
      />
      {showLegend && <Legend />}
      <p className="sr-only" role="status" aria-live="polite">{loading ? "Loading roster" : `${totalShown} visits shown`}</p>

      {nSel > 1 && editable && (
        <div role="toolbar" aria-label="Bulk actions" className="flex flex-wrap items-center gap-2 rounded-xl border bg-accent/40 px-3 py-1.5 text-xs">
          <b>{nSel} selected</b>
          <button type="button" onClick={() => setPicker({ kind: "reassign" })} className="rounded-lg border bg-background px-2 py-1 hover:bg-accent">Reassign…</button>
          <button type="button" onClick={editor.unassignSelected} className="rounded-lg border bg-background px-2 py-1 hover:bg-accent">Unassign</button>
          <button type="button" onClick={() => editor.duplicateSelected([1])} className="rounded-lg border bg-background px-2 py-1 hover:bg-accent">Duplicate to next day</button>
          <button type="button" onClick={() => setPicker({ kind: "duplicate" })} className="rounded-lg border bg-background px-2 py-1 hover:bg-accent">Duplicate to…</button>
          <button type="button" onClick={editor.copy} className="rounded-lg border bg-background px-2 py-1 hover:bg-accent">Copy</button>
          <button type="button" onClick={editor.deleteSelected} className="rounded-lg border border-red-500/50 bg-background px-2 py-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950">Delete</button>
          <button type="button" onClick={editor.clearSelection} className="ml-auto underline">Clear selection</button>
        </div>
      )}

      <div className="flex min-h-[420px] gap-3" style={{ height: "calc(100dvh - 15rem)" }}>
        <div className={cn("min-w-0 flex-1", loading && "opacity-70 transition-opacity")}>{body}</div>
        {trayOpen && (
          <aside
            className={cn(
              "w-72 shrink-0",
              isMobile && "fixed inset-x-2 bottom-2 z-40 h-[55dvh] w-auto rounded-xl bg-background shadow-2xl",
            )}
          >
            <UnassignedTray items={tray} selectedId={nSel === 1 ? [...editor.selection][0] : null} onSelect={onTray} draggable={!!timelineEdit} />
          </aside>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {editable
          ? "Drag a visit to move it (to another row to reassign) · drag its edges to resize · drag empty space to create · Shift+drag to select several · Ctrl/Shift+click adds to the selection · right-click for more · Ctrl+Z / Ctrl+Shift+Z undo / redo · Ctrl+C / Ctrl+V copy / paste · Ctrl+D duplicate · Del delete · N new visit. "
          : ""}
        Views: D day · W week · M month · T timeline · C clients · [ ] previous / next · . today · arrow keys move between visits · Enter opens a visit.
      </p>

      {form && (
        <VisitForm
          key={form.visit?.id ?? `new-${form.draft?.startMs}`}
          visit={form.visit}
          draft={form.draft}
          at={form.at}
          clients={clients}
          carers={carers}
          skills={skills}
          visits={visits}
          orgId={visits[0]?.org_id ?? ""}
          editor={editor}
          onClose={() => setForm(null)}
          onReload={refresh}
        />
      )}
      {menu && <ContextMenu at={menu.at} items={menuItems(menu)} onClose={() => setMenu(null)} />}
      {picker?.kind === "reassign" && (
        <PickDialog
          title={`Reassign ${nSel} visit${nSel === 1 ? "" : "s"} to`}
          confirmLabel="Reassign"
          mode="one"
          options={carers.map((c) => ({ value: c.carer_id, label: c.full_name }))}
          onCancel={() => setPicker(null)}
          onConfirm={([id]) => {
            setPicker(null);
            const to = refOf(id);
            if (to) editor.reassignSelected(to);
          }}
        />
      )}
      {picker?.kind === "duplicate" && (
        <PickDialog
          title="Duplicate to days"
          confirmLabel="Duplicate"
          mode="many"
          options={duplicateOptions}
          onCancel={() => setPicker(null)}
          onConfirm={(vals) => {
            setPicker(null);
            editor.duplicateSelected(vals.map(Number));
          }}
        />
      )}
      {editor.override && <OverrideDialog prompt={editor.override} onConfirm={editor.confirmOverride} onCancel={editor.cancelOverride} />}
      {editor.toast && (
        <div
          role={editor.toast.tone === "error" ? "alert" : "status"}
          className={cn(
            "fixed bottom-4 left-1/2 z-[90] flex max-w-md -translate-x-1/2 items-start gap-3 rounded-xl border px-4 py-2.5 text-sm shadow-xl",
            editor.toast.tone === "error" ? "border-red-500/50 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100" : "bg-popover",
          )}
        >
          <span>{editor.toast.text}</span>
          <button type="button" onClick={editor.dismissToast} aria-label="Dismiss" className="shrink-0 opacity-70 hover:opacity-100">×</button>
        </div>
      )}
    </div>
  );
}
