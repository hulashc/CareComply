import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS, activeFilterCount, filterVisits, matchesVisit, visibleCarers, type Filters } from "./filter";
import { carerHours, formatHours } from "./hours";
import { OPEN_ROW, blockedSpans, groupByCarer, groupByClient, groupByDay, overlapping } from "./group";
import { fixedRowWindow, inWindow, packLanes, xOf } from "./layout";
import { rangeFor, rangeTitle, stepDate } from "./range";
import { defaultState, initialState, parseState, serializeState } from "./state";
import { visitType } from "./status";
import { trayItems } from "./tray";
import type { RosterCarer } from "./types";
import type { VisitRow } from "../roster/types";

let n = 0;
function visit(over: Partial<VisitRow> & { start: string; end: string }): VisitRow {
  const { start, end, ...rest } = over;
  return {
    id: `v${++n}`, org_id: "o", client_id: "c1", client_name: "Eleanor Whitmore", location_id: null,
    start_time: start, end_time: end, status: "assigned", roster_state: "published", published_at: null,
    required_carers: 1, required_skills: [], notes: null, series_id: null, occurrence_date: null,
    is_series_exception: false, actual_start: null, actual_end: null, created_at: "", updated_at: "",
    carers: [{ carer_id: "a", slot: 1, full_name: "Sarah Mitchell" }], open_slots: 0, ...rest,
  };
}
const ctx = { clientTeam: new Map<string, string | null>([["c1", "teamA"], ["c2", "teamB"]]) };
const F = (over: Partial<Filters>): Filters => ({ ...EMPTY_FILTERS, ...over });

describe("rangeFor / stepDate / rangeTitle", () => {
  it("week is Monday-Sunday", () => {
    const r = rangeFor("week", "2026-10-14"); // Wednesday
    expect([r.from, r.to, r.days.length]).toEqual(["2026-10-12", "2026-10-18", 7]);
  });
  it("month is the 6-week grid starting on the Monday on/before the 1st", () => {
    const r = rangeFor("month", "2026-10-14");
    expect([r.from, r.days.length, r.to]).toEqual(["2026-09-28", 42, "2026-11-08"]);
  });
  it("day is one date and is 25 real hours on the autumn clock change", () => {
    const r = rangeFor("day", "2026-10-25");
    expect(r.days).toEqual(["2026-10-25"]);
    expect((r.end.getTime() - r.start.getTime()) / 3_600_000).toBe(25);
  });
  it("steps by a day, week or month", () => {
    expect(stepDate("day", "2026-10-31", 1)).toBe("2026-11-01");
    expect(stepDate("timeline", "2026-10-14", -1)).toBe("2026-10-07");
    expect(stepDate("month", "2026-12-20", 1)).toBe("2027-01-01");
    expect(stepDate("month", "2026-01-20", -1)).toBe("2025-12-01");
  });
  it("titles", () => {
    expect(rangeTitle("week", "2026-10-14")).toBe("12 – 18 Oct 2026");
    expect(rangeTitle("month", "2026-10-14")).toBe("October 2026");
  });
});

describe("visitType (London time)", () => {
  it("buckets by London hour, not UTC", () => {
    expect(visitType("2026-07-15T06:30:00Z")).toBe("morning"); // 07:30 BST
    expect(visitType("2026-07-15T10:30:00Z")).toBe("lunch"); // 11:30 BST
    expect(visitType("2026-07-15T15:00:00Z")).toBe("tea"); // 16:00 BST
    expect(visitType("2026-07-15T19:30:00Z")).toBe("evening"); // 20:30 BST
    expect(visitType("2026-07-15T03:00:00Z")).toBe("other"); // 04:00 BST
  });
});

describe("filters and search", () => {
  const a = visit({ start: "2026-07-15T07:00:00Z", end: "2026-07-15T08:00:00Z", required_skills: ["hoist_transfers"], notes: "Key safe 1234" });
  const b = visit({ start: "2026-07-15T17:30:00Z", end: "2026-07-15T18:30:00Z", client_id: "c2", client_name: "José Álvarez", status: "unassigned", carers: [], open_slots: 1 });
  const all = [a, b];

  it("no filters returns the same array", () => {
    expect(filterVisits(all, EMPTY_FILTERS, ctx)).toBe(all);
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
  });
  it("filters by carer, client, team, type, status and skill", () => {
    expect(filterVisits(all, F({ carers: ["a"] }), ctx)).toEqual([a]);
    expect(filterVisits(all, F({ clients: ["c2"] }), ctx)).toEqual([b]);
    expect(filterVisits(all, F({ teams: ["teamB"] }), ctx)).toEqual([b]);
    expect(filterVisits(all, F({ types: ["evening"] }), ctx)).toEqual([b]); // 17:30Z = 18:30 BST
    expect(filterVisits(all, F({ statuses: ["unassigned"] }), ctx)).toEqual([b]);
    expect(filterVisits(all, F({ skills: ["hoist_transfers", "peg_feeding"] }), ctx)).toEqual([a]);
  });
  it("filters combine with AND", () => {
    expect(filterVisits(all, F({ clients: ["c1"], statuses: ["unassigned"] }), ctx)).toEqual([]);
    expect(activeFilterCount(F({ clients: ["c1"], q: "x" }))).toBe(2);
  });
  it("search matches client, carer and notes, ignoring case and accents, all terms required", () => {
    expect(matchesVisit(b, F({ q: "jose alvarez" }), ctx)).toBe(true);
    expect(matchesVisit(a, F({ q: "SARAH" }), ctx)).toBe(true);
    expect(matchesVisit(a, F({ q: "key safe" }), ctx)).toBe(true);
    expect(matchesVisit(a, F({ q: "sarah nobody" }), ctx)).toBe(false);
  });
  it("carer rows: all carers by default, selected carers, or only those with visits on screen", () => {
    const carers = ["a", "b", "c"].map((id) => ({ carer_id: id, full_name: id }) as RosterCarer);
    expect(visibleCarers(carers, all, EMPTY_FILTERS)).toHaveLength(3);
    expect(visibleCarers(carers, all, F({ carers: ["b"] })).map((c) => c.carer_id)).toEqual(["b"]);
    expect(visibleCarers(carers, [a], F({ q: "sarah" })).map((c) => c.carer_id)).toEqual(["a"]);
  });
});

describe("carerHours", () => {
  const day = { start: Date.parse("2026-07-15T00:00:00Z"), end: Date.parse("2026-07-16T00:00:00Z") };
  const week = { start: Date.parse("2026-07-13T00:00:00Z"), end: Date.parse("2026-07-20T00:00:00Z") };
  it("sums day and week hours per carer, skipping cancelled", () => {
    const vs = [
      visit({ start: "2026-07-15T08:00:00Z", end: "2026-07-15T09:30:00Z" }),
      visit({ start: "2026-07-14T08:00:00Z", end: "2026-07-14T10:00:00Z" }),
      visit({ start: "2026-07-15T12:00:00Z", end: "2026-07-15T13:00:00Z", status: "cancelled" }),
      visit({ start: "2026-07-21T08:00:00Z", end: "2026-07-21T09:00:00Z" }),
    ];
    expect(carerHours(vs, day, week).get("a")).toEqual({ day: 1.5, week: 3.5 });
  });
  it("counts only the part of an overnight visit inside the window, and both carers of a double-up", () => {
    const night = visit({ start: "2026-07-15T22:00:00Z", end: "2026-07-16T02:00:00Z", carers: [{ carer_id: "a", slot: 1, full_name: "A" }, { carer_id: "b", slot: 2, full_name: "B" }] });
    const h = carerHours([night], day, week);
    expect(h.get("a")).toEqual({ day: 2, week: 4 });
    expect(h.get("b")).toEqual({ day: 2, week: 4 });
  });
  it("formats", () => {
    expect(formatHours(6.5)).toBe("6.5h");
    expect(formatHours(32)).toBe("32h");
  });
});

describe("layout", () => {
  it("packs overlaps into lanes; back-to-back shares a lane", () => {
    const { placed, lanes } = packLanes([
      { start: 0, end: 10 }, { start: 5, end: 15 }, { start: 10, end: 20 }, { start: 12, end: 14 },
    ]);
    expect(lanes).toBe(3);
    expect(placed.map((p) => p.lane)).toEqual([0, 1, 0, 2]);
  });
  it("positions on the axis and windows horizontally", () => {
    expect(xOf(3_600_000 * 2, 0, 30)).toBe(60);
    expect(inWindow([{ left: 0, right: 10 }, { left: 50, right: 60 }, { left: 200, right: 210 }], 40, 100)).toEqual([{ left: 50, right: 60 }]);
  });
  it("windows fixed-height rows with overscan, clamped", () => {
    expect(fixedRowWindow(0, 100, 10, 1000, 2)).toEqual([0, 12]);
    expect(fixedRowWindow(5000, 100, 10, 1000, 2)).toEqual([498, 512]);
    expect(fixedRowWindow(99999, 100, 10, 50, 2)).toEqual([49, 49]);
    expect(fixedRowWindow(0, 100, 10, 0)).toEqual([0, -1]);
  });
});

describe("trayItems", () => {
  const now = new Date("2026-07-15T10:00:00Z");
  it("lists open, upcoming, non-cancelled visits soonest first with urgency", () => {
    const later = visit({ id: "later", start: "2026-07-17T09:00:00Z", end: "2026-07-17T10:00:00Z", status: "unassigned", open_slots: 1, carers: [] });
    const soon = visit({ id: "soon", start: "2026-07-15T15:00:00Z", end: "2026-07-15T16:00:00Z", status: "unassigned", open_slots: 2, carers: [] });
    const running = visit({ id: "running", start: "2026-07-15T09:30:00Z", end: "2026-07-15T10:30:00Z", status: "unassigned", open_slots: 1, carers: [] });
    const over = visit({ id: "over", start: "2026-07-15T07:00:00Z", end: "2026-07-15T08:00:00Z", status: "unassigned", open_slots: 1, carers: [] });
    const cancelled = visit({ id: "x", start: "2026-07-16T07:00:00Z", end: "2026-07-16T08:00:00Z", status: "cancelled", open_slots: 1 });
    const staffed = visit({ id: "ok", start: "2026-07-16T07:00:00Z", end: "2026-07-16T08:00:00Z" });
    const items = trayItems([later, soon, running, over, cancelled, staffed], now);
    expect(items.map((i) => i.visit.id)).toEqual(["running", "soon", "later"]);
    expect(items[1].needed).toBe(2);
    expect(items[0].urgency.label).toBe("Started");
    expect(items[1].urgency.level).toBe("red");
  });
});

describe("view state", () => {
  const base = defaultState(new Date("2026-10-14T12:00:00Z"));
  it("round-trips through the URL", () => {
    const s = { ...base, view: "timeline" as const, zoom: "lg" as const, filters: F({ carers: ["a", "b"], statuses: ["unassigned"], types: ["morning"], q: "smith" }) };
    expect(parseState(serializeState(s), base)).toEqual(s);
  });
  it("ignores invalid values and keeps defaults", () => {
    const p = new URLSearchParams("v=bogus&d=2026-02-30&z=huge&s=nope,unassigned&ty=x");
    const r = parseState(p, base);
    expect([r.view, r.date, r.zoom]).toEqual([base.view, base.date, base.zoom]);
    expect(r.filters.statuses).toEqual(["unassigned"]);
    expect(r.filters.types).toEqual([]);
  });
  it("restores the last view and filters from storage but always opens on today", () => {
    const saved = serializeState({ ...base, view: "month", date: "2026-01-05", filters: F({ teams: ["t1"] }) }).toString();
    const s = initialState("", saved, new Date("2026-10-14T12:00:00Z"));
    expect(s.view).toBe("month");
    expect(s.filters.teams).toEqual(["t1"]);
    expect(s.date).toBe("2026-10-14");
  });
  it("the URL wins over storage, and corrupt storage is harmless", () => {
    const saved = serializeState({ ...base, view: "month" }).toString();
    expect(initialState("?v=day&d=2026-10-20", saved).view).toBe("day");
    expect(initialState("", "%%%garbage").view).toBe(base.view);
  });
});

describe("grouping", () => {
  const a = visit({ start: "2026-07-15T08:00:00Z", end: "2026-07-15T09:00:00Z" });
  const b = visit({ start: "2026-07-15T06:00:00Z", end: "2026-07-15T07:00:00Z", carers: [] , status: "unassigned", open_slots: 1 });
  const dbl = visit({ start: "2026-07-16T08:00:00Z", end: "2026-07-16T09:00:00Z", carers: [{ carer_id: "a", slot: 1, full_name: "A" }, { carer_id: "b", slot: 2, full_name: "B" }] });
  const cancelledOpen = visit({ start: "2026-07-16T10:00:00Z", end: "2026-07-16T11:00:00Z", carers: [], status: "cancelled" });
  const late = visit({ start: "2026-07-15T23:30:00Z", end: "2026-07-16T00:30:00Z" }); // 00:30 BST on the 16th
  const all = [a, b, dbl, cancelledOpen, late];

  it("groups by London day, sorted by start", () => {
    const m = groupByDay(all);
    expect(m.get("2026-07-15")?.map((v) => v.id)).toEqual([b.id, a.id]);
    expect(m.get("2026-07-16")?.map((v) => v.id)).toContain(late.id); // London date, not UTC
  });
  it("groups by carer, putting carer-less live visits in the open row and a double-up under both", () => {
    const m = groupByCarer(all);
    expect(m.get(OPEN_ROW)).toEqual([b]);
    expect(m.get("a")?.map((v) => v.id)).toContain(dbl.id);
    expect(m.get("b")?.map((v) => v.id)).toEqual([dbl.id]);
  });
  it("groups by client and finds overlaps", () => {
    expect(groupByClient(all).get("c1")).toHaveLength(5);
    expect(overlapping(all, Date.parse("2026-07-15T08:30:00Z"), Date.parse("2026-07-15T08:45:00Z"))).toEqual([a]);
  });
  it("turns leave and unavailability into blocked spans (whole London days for leave)", () => {
    const spans = blockedSpans({
      absences: [
        { id: "1", absence_type: "sick_leave", start_date: "2026-07-15", end_date: "2026-07-16", status: "approved", reason: null },
        { id: "2", absence_type: "holiday", start_date: "2026-07-20", end_date: "2026-07-20", status: "pending", reason: null },
        { id: "3", absence_type: "holiday", start_date: "2026-07-22", end_date: "2026-07-22", status: "rejected", reason: null },
      ],
      unavailability: [{ id: "u", starts_at: "2026-07-17T12:00:00Z", ends_at: "2026-07-17T15:00:00Z", reason: "Appointment" }],
    });
    expect(spans).toHaveLength(3);
    expect(spans[0]).toMatchObject({ start: Date.parse("2026-07-14T23:00:00Z"), end: Date.parse("2026-07-16T23:00:00Z"), label: "sick leave" });
    expect(spans[1].tentative).toBe(true);
    expect(spans[2].label).toBe("Unavailable: Appointment");
  });
});
