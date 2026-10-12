import { describe, expect, it } from "vitest";
import { applyCommand, cmd, copyPreviousWeek, duplicateTo, moveVisit, pasteAt, reassign, resizeVisit, revertCommand, unassign } from "./commands";
import { emptyHistory, record, redoStep, undoStep } from "./history";
import { snapMs } from "./snap";
import type { VisitRow } from "../roster/types";

const base = (id: string, start: string, end: string, over: Partial<VisitRow> = {}): VisitRow => ({
  id,
  org_id: "o",
  client_id: "cl",
  client_name: "Client",
  location_id: null,
  start_time: start,
  end_time: end,
  status: "assigned",
  roster_state: "published",
  published_at: null,
  required_carers: 1,
  required_skills: [],
  notes: null,
  series_id: null,
  occurrence_date: null,
  is_series_exception: false,
  actual_start: null,
  actual_end: null,
  created_at: "",
  updated_at: "",
  carers: [{ carer_id: "c1", full_name: "Ann", slot: 1 }],
  open_slots: 0,
  ...over,
});

const Z = (t: string) => `2026-03-02T${t}:00.000Z`;
const bob = { carer_id: "c2", full_name: "Bob" };

describe("snap", () => {
  it("rounds to the nearest boundary", () => {
    expect(snapMs(Date.parse(Z("09:07")), 15)).toBe(Date.parse(Z("09:00")));
    expect(snapMs(Date.parse(Z("09:08")), 15)).toBe(Date.parse(Z("09:15")));
    expect(snapMs(Date.parse(Z("09:12")), 5)).toBe(Date.parse(Z("09:10")));
    expect(snapMs(Date.parse(Z("09:14")), 30)).toBe(Date.parse(Z("09:00")));
  });
});

describe("move / resize / reassign", () => {
  const v = base("a", Z("09:00"), Z("10:00"));

  it("moves in time keeping duration and snapping", () => {
    const m = moveVisit(v, { deltaMs: 37 * 60_000, snap: 15 });
    expect(m.start_time).toBe(Z("09:30"));
    expect(m.end_time).toBe(Z("10:30"));
  });

  it("moves to another carer and keeps status assigned", () => {
    const m = moveVisit(v, { toCarer: bob, fromCarerId: "c1" });
    expect(m.carers.map((c) => c.carer_id)).toEqual(["c2"]);
    expect(m.status).toBe("assigned");
  });

  it("resizes an edge and never goes below the minimum", () => {
    expect(resizeVisit(v, "end", Date.parse(Z("11:02")), 15).end_time).toBe(Z("11:00"));
    expect(resizeVisit(v, "end", Date.parse(Z("08:00")), 5).end_time).toBe(Z("09:05"));
    expect(resizeVisit(v, "start", Date.parse(Z("11:00")), 5).start_time).toBe(Z("09:55"));
  });

  it("assigning from the tray fills an open slot and flips unassigned to assigned", () => {
    const open = base("o", Z("09:00"), Z("10:00"), { status: "unassigned", carers: [], open_slots: 1 });
    const a = reassign(open, bob);
    expect(a.status).toBe("assigned");
    expect(a.carers).toHaveLength(1);
  });

  it("double-up: adds a second carer without replacing the first", () => {
    const dbl = base("d", Z("09:00"), Z("10:00"), { required_carers: 2, open_slots: 1 });
    const r = reassign(dbl, bob);
    expect(r.carers.map((c) => c.carer_id)).toEqual(["c1", "c2"]);
    expect(r.carers.map((c) => c.slot)).toEqual([1, 2]);
    expect(r.open_slots).toBe(0);
  });

  it("unassigning the last carer returns the visit to the tray", () => {
    const u = unassign(v, "c1");
    expect(u.status).toBe("unassigned");
    expect(u.open_slots).toBe(1);
  });
});

describe("apply / revert round trips", () => {
  const rows = [base("a", Z("09:00"), Z("10:00")), base("b", Z("11:00"), Z("12:00"))];

  it("move: apply then revert restores the original", () => {
    const c = cmd("Move", [rows[0]], [moveVisit(rows[0], { deltaMs: 3_600_000 })]);
    const after = applyCommand(rows, c);
    expect(after.find((v) => v.id === "a")?.start_time).toBe(Z("10:00"));
    expect(revertCommand(after, c)).toEqual(rows);
  });

  it("create: revert removes it, re-apply puts the same id back", () => {
    const made = base("n", Z("13:00"), Z("14:00"));
    const c = cmd("Create", [], [made]);
    const after = applyCommand(rows, c);
    expect(after.map((v) => v.id)).toContain("n");
    expect(revertCommand(after, c)).toEqual(rows);
    expect(applyCommand(revertCommand(after, c), c)).toEqual(after);
  });

  it("delete: revert restores the exact rows", () => {
    const c = cmd("Delete", [rows[0], rows[1]], []);
    const after = applyCommand(rows, c);
    expect(after).toEqual([]);
    expect(revertCommand(after, c)).toEqual(rows);
  });
});

describe("undo / redo history", () => {
  const a = base("a", Z("09:00"), Z("10:00"));
  const moved = moveVisit(a, { deltaMs: 3_600_000 });
  const c1 = cmd("Move", [a], [moved]);

  it("undo runs the inverse, redo runs the original, and a new action clears redo", () => {
    let h = record(emptyHistory(), c1);
    const u = undoStep(h)!;
    expect(u.run.after).toEqual([a]);
    h = u.commit;
    expect(h.past).toHaveLength(0);
    expect(h.future).toHaveLength(1);
    const r = redoStep(h)!;
    expect(r.run.after).toEqual([moved]);
    h = r.commit;
    h = undoStep(h)!.commit;
    h = record(h, cmd("Other", [a], [a]));
    expect(h.future).toHaveLength(0);
  });

  it("does nothing when there is nothing to undo or redo", () => {
    expect(undoStep(emptyHistory())).toBeNull();
    expect(redoStep(emptyHistory())).toBeNull();
  });

  it("undo then redo leaves rows identical", () => {
    const start = [a];
    const done = applyCommand(start, c1);
    const h = record(emptyHistory(), c1);
    const un = applyCommand(done, undoStep(h)!.run);
    expect(un).toEqual(start);
    expect(applyCommand(un, redoStep(undoStep(h)!.commit)!.run)).toEqual(done);
  });
});

describe("duplicate / paste / copy previous week", () => {
  const one = base("a", Z("09:00"), Z("10:00"));
  const series = base("s", Z("11:00"), Z("12:00"), { series_id: "ser", occurrence_date: "2026-03-02" });
  const cancelled = base("x", Z("13:00"), Z("14:00"), { status: "cancelled" });

  it("duplicates to several days with fresh ids, detached from series, as drafts", () => {
    const out = duplicateTo([series], [1, 2]);
    expect(out).toHaveLength(2);
    expect(new Set(out.map((v) => v.id)).size).toBe(2);
    expect(out[0].id).not.toBe(series.id);
    expect(out[0].series_id).toBeNull();
    expect(out[0].roster_state).toBe("draft");
    expect(out[1].start_time).toBe("2026-03-04T11:00:00.000Z");
  });

  it("copy previous week skips series and cancelled visits and moves +7 days", () => {
    const out = copyPreviousWeek([one, series, cancelled]);
    expect(out).toHaveLength(1);
    expect(out[0].start_time).toBe("2026-03-09T09:00:00.000Z");
  });

  it("paste keeps relative offsets and can retarget to one carer", () => {
    const two = base("b", Z("10:30"), Z("11:00"));
    const out = pasteAt([one, two], Date.parse("2026-03-03T14:00:00.000Z"), 15, bob);
    expect(out.map((v) => v.start_time)).toEqual(["2026-03-03T14:00:00.000Z", "2026-03-03T15:30:00.000Z"]);
    expect(out.every((v) => v.carers[0].carer_id === "c2")).toBe(true);
  });

  it("keeps the London wall-clock time across the spring clock change", () => {
    // Sat 28 Mar 2026 09:00 GMT; the clocks go forward overnight, so Mon 30 Mar 09:00 is 08:00 UTC.
    const sat = base("w", "2026-03-28T09:00:00.000Z", "2026-03-28T10:00:00.000Z");
    const [mon] = duplicateTo([sat], [2]);
    expect(mon.start_time).toBe("2026-03-30T08:00:00.000Z");
    expect(mon.end_time).toBe("2026-03-30T09:00:00.000Z");
  });

  it("paste of nothing is a no-op", () => {
    expect(pasteAt([], 0, 15)).toEqual([]);
  });
});
