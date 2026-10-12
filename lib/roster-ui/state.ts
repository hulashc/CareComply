import { londonDateOf } from "../dates/london";
import { parseCalendarDate } from "../dates/london";
import { STATUS_ORDER } from "./status";
import { SNAPS, type Snap } from "./snap";
import { EMPTY_FILTERS, type Filters } from "./filter";
import { VIEWS, VISIT_TYPES, type RosterView, type VisitType } from "./types";

// The roster's view state (view, date, filters, search, zoom). It lives in the URL, so a view is
// shareable and survives reload, and is mirrored to localStorage so the LAST view and filters come
// back when you return with a bare /dashboard/roster.

export type Zoom = "sm" | "md" | "lg";
/** Pixels per hour on the timeline axis. */
export const ZOOM_PX: Record<Zoom, number> = { sm: 14, md: 30, lg: 60 };

export interface RosterState {
  view: RosterView;
  /** Anchor date (London), YYYY-MM-DD. */
  date: string;
  filters: Filters;
  zoom: Zoom;
  /** Drag snap, minutes. */
  snap: Snap;
}

export const STORAGE_KEY = "carecomply.roster.state.v1";

export function defaultState(now: Date = new Date()): RosterState {
  return { view: "week", date: londonDateOf(now), filters: EMPTY_FILTERS, zoom: "md", snap: 15 };
}

const list = (p: URLSearchParams, key: string) => (p.get(key) ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const validDate = (s: string | null) => {
  if (!s) return false;
  try {
    parseCalendarDate(s);
    return true;
  } catch {
    return false;
  }
};

/** Parse state from a query string; anything missing or invalid falls back to `base`. */
export function parseState(params: URLSearchParams, base: RosterState): RosterState {
  const view = params.get("v");
  const zoom = params.get("z");
  const date = params.get("d");
  return {
    view: (VIEWS as readonly string[]).includes(view ?? "") ? (view as RosterView) : base.view,
    date: validDate(date) ? (date as string) : base.date,
    zoom: zoom === "sm" || zoom === "md" || zoom === "lg" ? zoom : base.zoom,
    snap: (SNAPS as readonly number[]).includes(Number(params.get("sn"))) ? (Number(params.get("sn")) as Snap) : base.snap,
    filters: {
      carers: params.has("c") ? list(params, "c") : base.filters.carers,
      clients: params.has("cl") ? list(params, "cl") : base.filters.clients,
      teams: params.has("t") ? list(params, "t") : base.filters.teams,
      types: params.has("ty") ? (list(params, "ty").filter((x) => (VISIT_TYPES as readonly string[]).includes(x)) as VisitType[]) : base.filters.types,
      statuses: params.has("s") ? (list(params, "s").filter((x) => (STATUS_ORDER as string[]).includes(x)) as Filters["statuses"]) : base.filters.statuses,
      skills: params.has("sk") ? list(params, "sk") : base.filters.skills,
      q: params.has("q") ? (params.get("q") ?? "").slice(0, 80) : base.filters.q,
    },
  };
}

/** Only non-default values are written, to keep URLs short. */
export function serializeState(s: RosterState): URLSearchParams {
  const p = new URLSearchParams();
  p.set("v", s.view);
  p.set("d", s.date);
  if (s.zoom !== "md") p.set("z", s.zoom);
  if (s.snap !== 15) p.set("sn", String(s.snap));
  const f = s.filters;
  if (f.carers.length) p.set("c", f.carers.join(","));
  if (f.clients.length) p.set("cl", f.clients.join(","));
  if (f.teams.length) p.set("t", f.teams.join(","));
  if (f.types.length) p.set("ty", f.types.join(","));
  if (f.statuses.length) p.set("s", f.statuses.join(","));
  if (f.skills.length) p.set("sk", f.skills.join(","));
  if (f.q.trim()) p.set("q", f.q.trim());
  return p;
}

/**
 * Initial state: the URL wins; otherwise the last saved view and filters (but always today's date,
 * so you never reopen on a stale week); otherwise defaults.
 */
export function initialState(search: string, saved: string | null, now: Date = new Date()): RosterState {
  const base = defaultState(now);
  const params = new URLSearchParams(search);
  if (params.has("v") || params.has("d")) return parseState(params, base);
  if (saved) {
    try {
      const restored = parseState(new URLSearchParams(saved), base);
      return { ...restored, date: base.date };
    } catch {
      /* ignore a corrupt saved value */
    }
  }
  return base;
}
