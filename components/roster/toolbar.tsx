"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, CopyPlus, ListTodo, RefreshCw, Redo2, Search, Undo2 } from "lucide-react";
import { EMPTY_FILTERS, activeFilterCount, type Filters } from "@/lib/roster-ui/filter";
import { rangeTitle } from "@/lib/roster-ui/range";
import { SNAPS, type Snap } from "@/lib/roster-ui/snap";
import { ZOOM_PX, type RosterState, type Zoom } from "@/lib/roster-ui/state";
import { STATUS_ORDER, STATUS_STYLES, VISIT_TYPE_LABELS } from "@/lib/roster-ui/status";
import { VIEWS, VISIT_TYPES, type RosterView } from "@/lib/roster-ui/types";
import { cn } from "@/lib/utils";
import { MultiSelect, type Option } from "./multi-select";

const VIEW_LABELS: Record<RosterView, string> = { day: "Day", week: "Week", month: "Month", timeline: "Timeline", client: "Clients" };
const VIEW_KEYS: Record<RosterView, string> = { day: "D", week: "W", month: "M", timeline: "T", client: "C" };

export interface FilterOptions {
  carers: Option[];
  clients: Option[];
  teams: Option[];
  skills: Option[];
}

interface Props {
  state: RosterState;
  options: FilterOptions;
  trayCount: number;
  trayOpen: boolean;
  loading: boolean;
  showLegend: boolean;
  onView: (v: RosterView) => void;
  onStep: (dir: 1 | -1) => void;
  onToday: () => void;
  onFilters: (f: Filters) => void;
  onZoom: (z: Zoom) => void;
  onTray: () => void;
  onLegend: () => void;
  onRefresh: () => void;
  edit?: {
    canUndo: boolean;
    canRedo: boolean;
    undoLabel: string | null;
    redoLabel: string | null;
    saving: boolean;
    onUndo: () => void;
    onRedo: () => void;
    onSnap: (s: Snap) => void;
    onNew: () => void;
    onCopyPrevWeek: () => void;
  };
}

export function Toolbar(p: Props) {
  const { state } = p;
  const f = state.filters;
  const [q, setQ] = useState(f.q);
  useEffect(() => setQ(f.q), [f.q]);
  // Debounce the search box so typing never re-filters 1,000 visits per keystroke.
  useEffect(() => {
    if (q === f.q) return;
    const t = setTimeout(() => p.onFilters({ ...f, q }), 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => p.onFilters({ ...f, [k]: v });
  const nActive = activeFilterCount(f);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Roster view" className="inline-flex rounded-xl border bg-muted p-0.5">
          {VIEWS.map((v) => (
            <button
              key={v}
              role="tab"
              type="button"
              aria-selected={state.view === v}
              aria-keyshortcuts={VIEW_KEYS[v]}
              title={`${VIEW_LABELS[v]} (${VIEW_KEYS[v]})`}
              onClick={() => p.onView(v)}
              className={cn(
                "rounded-lg px-3 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                state.view === v ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>

        <div className="inline-flex items-center gap-1">
          <button type="button" onClick={() => p.onStep(-1)} aria-label="Previous" aria-keyshortcuts="[" className="rounded-lg border p-1.5 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={p.onToday} aria-keyshortcuts="." className="rounded-lg border px-2.5 py-1 text-xs font-medium hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
            Today
          </button>
          <button type="button" onClick={() => p.onStep(1)} aria-label="Next" aria-keyshortcuts="]" className="rounded-lg border p-1.5 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <h2 className="text-sm font-semibold" aria-live="polite">{rangeTitle(state.view, state.date)}</h2>

        <div className="ml-auto flex items-center gap-2">
          {p.edit && (
            <>
              <span role="status" className="text-xs text-muted-foreground">{p.edit.saving ? "Saving…" : ""}</span>
              <button type="button" onClick={p.edit.onNew} aria-keyshortcuts="N" className="rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring">
                + New visit
              </button>
              <div role="group" aria-label="History" className="inline-flex rounded-lg border">
                <button type="button" disabled={!p.edit.canUndo} onClick={p.edit.onUndo} aria-label={p.edit.undoLabel ? `Undo ${p.edit.undoLabel}` : "Undo"} title={p.edit.undoLabel ? `Undo: ${p.edit.undoLabel} (Ctrl+Z)` : "Nothing to undo"} className="p-1.5 hover:bg-accent disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-ring">
                  <Undo2 className="h-4 w-4" />
                </button>
                <button type="button" disabled={!p.edit.canRedo} onClick={p.edit.onRedo} aria-label={p.edit.redoLabel ? `Redo ${p.edit.redoLabel}` : "Redo"} title={p.edit.redoLabel ? `Redo: ${p.edit.redoLabel} (Ctrl+Shift+Z)` : "Nothing to redo"} className="border-l p-1.5 hover:bg-accent disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-ring">
                  <Redo2 className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
          {p.loading && <span role="status" className="text-xs text-muted-foreground">Loading…</span>}
          <button type="button" onClick={p.onRefresh} aria-label="Refresh roster" className="rounded-lg border p-1.5 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
            <RefreshCw className={cn("h-4 w-4", p.loading && "animate-spin")} />
          </button>
          <button
            type="button"
            onClick={p.onTray}
            aria-pressed={p.trayOpen}
            className={cn("flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring", p.trayOpen && "border-primary text-primary")}
          >
            <ListTodo className="h-4 w-4" /> Needs a carer
            <span className="rounded-full bg-red-600 px-1.5 text-[10px] font-semibold text-white">{p.trayCount}</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="search">
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search client, carer, notes"
            aria-label="Search visits"
            className="h-8 w-56 rounded-lg border bg-background pl-8 pr-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <MultiSelect label="Carer" options={p.options.carers} selected={f.carers} onChange={(v) => set("carers", v)} />
        <MultiSelect label="Client" options={p.options.clients} selected={f.clients} onChange={(v) => set("clients", v)} />
        <MultiSelect label="Team / area" options={p.options.teams} selected={f.teams} onChange={(v) => set("teams", v)} />
        <MultiSelect label="Visit type" options={VISIT_TYPES.map((t) => ({ value: t, label: VISIT_TYPE_LABELS[t] }))} selected={f.types} onChange={(v) => set("types", v as Filters["types"])} />
        <MultiSelect label="Status" options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_STYLES[s].label }))} selected={f.statuses} onChange={(v) => set("statuses", v as Filters["statuses"])} />
        <MultiSelect label="Skills" options={p.options.skills} selected={f.skills} onChange={(v) => set("skills", v)} />
        {nActive > 0 && (
          <button type="button" onClick={() => p.onFilters(EMPTY_FILTERS)} className="rounded-lg px-2 py-1 text-xs text-muted-foreground underline hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
            Clear all ({nActive})
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {p.edit && (
            <>
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                Snap
                <select value={state.snap} onChange={(e) => p.edit!.onSnap(Number(e.target.value) as Snap)} aria-label="Snap to minutes" className="rounded-lg border bg-background px-1.5 py-1 text-xs text-foreground">
                  {SNAPS.map((n) => (
                    <option key={n} value={n}>{n} min</option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={p.edit.onCopyPrevWeek} className="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
                <CopyPlus className="h-3.5 w-3.5" /> Copy previous week
              </button>
            </>
          )}
          {(state.view === "timeline" || state.view === "client") && (
            <div role="group" aria-label="Zoom" className="inline-flex rounded-lg border">
              {(Object.keys(ZOOM_PX) as Zoom[]).map((z) => (
                <button key={z} type="button" aria-pressed={state.zoom === z} onClick={() => p.onZoom(z)} className={cn("px-2 py-1 text-xs focus-visible:ring-2 focus-visible:ring-ring", state.zoom === z ? "bg-accent font-semibold" : "text-muted-foreground")}>
                  {z === "sm" ? "Compact" : z === "md" ? "Normal" : "Wide"}
                </button>
              ))}
            </div>
          )}
          <button type="button" onClick={p.onLegend} aria-pressed={p.showLegend} className="rounded-lg border px-2.5 py-1 text-xs hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
            Legend
          </button>
        </div>
      </div>
    </div>
  );
}
