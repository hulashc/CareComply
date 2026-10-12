import { describe, expect, it } from "vitest";
import { londonParts } from "../dates/london";
import {
  PlanError,
  planCreate,
  planDelete,
  planEdit,
  selectAffected,
  type CreateInput,
} from "./series-plan";
import type { PlanVisit, RosterPlan, SeriesRow } from "./types";

const ORG = "00000000-0000-4000-8000-0000000000a1";
const CLIENT = "00000000-0000-4000-8000-0000000000c1";
const CARER_A = "00000000-0000-4000-8000-0000000000d1";
const CARER_B = "00000000-0000-4000-8000-0000000000d2";

let counter = 0;
const genUuid = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;

const base: CreateInput = {
  client_id: CLIENT,
  date: "2026-07-13", // Monday
  start_time: "08:00",
  end_time: "08:45",
  required_carers: 1,
  required_skills: [],
  roster_state: "draft",
};
const ctx = { orgId: ORG, today: "2026-07-13", genUuid };
const londonTime = (iso: string) => {
  const p = londonParts(new Date(iso));
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
};

/** Turn a create plan into the visits/series the edit and delete planners work from. */
function materialise(plan: RosterPlan): { series: SeriesRow | null; visits: PlanVisit[] } {
  const visits: PlanVisit[] = plan.shift_inserts.map((i) => ({
    id: i.id,
    client_id: i.client_id,
    location_id: i.location_id,
    start_time: i.start_time,
    end_time: i.end_time,
    status: "unassigned",
    roster_state: i.roster_state,
    series_id: i.series_id,
    occurrence_date: i.occurrence_date,
    is_series_exception: false,
    actual_start: null,
    required_carers: i.required_carers,
    required_skills: i.required_skills,
    notes: i.notes,
    carer_ids: [],
  }));
  return { series: plan.series_upserts[0] ?? null, visits };
}

/** A weekly Monday series (until 2026-08-03 -> 4 visits). */
function weeklySeries() {
  const { plan } = planCreate({ ...base, recurrence: { frequency: "weekly", repeat_every: 1, by_weekday: [], until_date: "2026-08-03" } }, ctx);
  return materialise(plan);
}

describe("planCreate", () => {
  it("a single visit is one insert with no series", () => {
    const { plan, visitIds, seriesId } = planCreate(base, ctx);
    expect(seriesId).toBeNull();
    expect(plan.series_upserts).toEqual([]);
    expect(plan.shift_inserts).toHaveLength(1);
    expect(plan.shift_inserts[0]).toMatchObject({ id: visitIds[0], series_id: null, occurrence_date: null, roster_state: "draft" });
    expect(plan.shift_inserts[0].start_time).toBe("2026-07-13T07:00:00.000Z"); // 08:00 BST
    expect(plan.shift_inserts[0].end_time).toBe("2026-07-13T07:45:00.000Z");
  });

  it("a weekly series materialises one visit per occurrence up to the end date", () => {
    const { plan, seriesId } = planCreate({ ...base, recurrence: { frequency: "weekly", repeat_every: 1, by_weekday: [], until_date: "2026-08-03" } }, ctx);
    expect(plan.shift_inserts.map((i) => i.occurrence_date)).toEqual(["2026-07-13", "2026-07-20", "2026-07-27", "2026-08-03"]);
    expect(plan.shift_inserts.every((i) => i.series_id === seriesId)).toBe(true);
    expect(plan.series_upserts[0]).toMatchObject({ frequency: "weekly", start_time: "08:00", duration_minutes: 45, until_date: "2026-08-03", generated_until: "2026-08-03" });
  });

  it("an open-ended series is materialised 12 weeks ahead", () => {
    const { plan } = planCreate({ ...base, recurrence: { frequency: "weekly", repeat_every: 1, by_weekday: [] } }, ctx);
    expect(plan.series_upserts[0].until_date).toBeNull();
    expect(plan.series_upserts[0].generated_until).toBe("2026-10-05"); // start + 84 days
    expect(plan.shift_inserts).toHaveLength(13);
  });

  it("a custom series uses the chosen weekdays", () => {
    const { plan } = planCreate({ ...base, recurrence: { frequency: "custom", repeat_every: 1, by_weekday: [5, 1, 3], until_date: "2026-07-19" } }, ctx);
    expect(plan.shift_inserts.map((i) => i.occurrence_date)).toEqual(["2026-07-13", "2026-07-15", "2026-07-17"]);
    expect(plan.series_upserts[0].by_weekday).toEqual([1, 3, 5]);
  });

  it("keeps 08:00 London across the clock change", () => {
    const { plan } = planCreate({ ...base, date: "2026-03-27", recurrence: { frequency: "daily", repeat_every: 1, by_weekday: [], until_date: "2026-03-31" } }, { ...ctx, today: "2026-03-27" });
    expect(plan.shift_inserts.map((i) => londonTime(i.start_time))).toEqual(["08:00", "08:00", "08:00", "08:00", "08:00"]);
    expect(plan.shift_inserts[1].start_time).toBe("2026-03-28T08:00:00.000Z"); // GMT
    expect(plan.shift_inserts[2].start_time).toBe("2026-03-29T07:00:00.000Z"); // BST
  });

  it("supports a visit that runs past midnight", () => {
    const { plan } = planCreate({ ...base, start_time: "22:00", end_time: "06:00" }, ctx);
    expect(plan.shift_inserts[0].start_time).toBe("2026-07-13T21:00:00.000Z");
    expect(plan.shift_inserts[0].end_time).toBe("2026-07-14T05:00:00.000Z");
  });

  it("rejects zero-length visits and recurrences with no occurrences", () => {
    expect(() => planCreate({ ...base, end_time: "08:00" }, ctx)).toThrow(PlanError);
    expect(() => planCreate({ ...base, recurrence: { frequency: "custom", repeat_every: 1, by_weekday: [2], until_date: "2026-07-13" } }, ctx)).toThrow(/no visits/);
  });
});

describe("planEdit scope 'this'", () => {
  it("moving the time of one visit makes it a series exception", () => {
    const { series, visits } = weeklySeries();
    const { plan, affected } = planEdit(visits[1], "this", { start_time: "09:30", end_time: "10:00" }, { series, visits });
    expect(affected).toEqual([visits[1].id]);
    expect(plan.shift_updates).toEqual([
      { id: visits[1].id, start_time: "2026-07-20T08:30:00.000Z", end_time: "2026-07-20T09:00:00.000Z", is_series_exception: true },
    ]);
    expect(plan.series_upserts).toEqual([]); // template untouched
  });

  it("moving one visit to another date keeps its original occurrence date", () => {
    const { series, visits } = weeklySeries();
    const { plan } = planEdit(visits[1], "this", { date: "2026-07-21" }, { series, visits });
    expect(plan.shift_updates[0]).toMatchObject({ start_time: "2026-07-21T07:00:00.000Z", is_series_exception: true });
    expect(plan.shift_updates[0].occurrence_date).toBeUndefined();
  });

  it("changing notes does not make an exception", () => {
    const { series, visits } = weeklySeries();
    const { plan } = planEdit(visits[0], "this", { notes: "Key safe 4821" }, { series, visits });
    expect(plan.shift_updates).toEqual([{ id: visits[0].id, notes: "Key safe 4821" }]);
  });

  it("works on a visit that is not in a series, whatever scope is asked for", () => {
    const { plan } = planCreate(base, ctx);
    const { visits } = materialise(plan);
    const result = planEdit(visits[0], "all", { notes: "x" }, { series: null, visits });
    expect(result.affected).toEqual([visits[0].id]);
  });

  it("lowering required carers unassigns the excess (non-lead) carer first", () => {
    const { series, visits } = weeklySeries();
    const v = { ...visits[0], required_carers: 2, carer_ids: [CARER_A, CARER_B] };
    const { plan } = planEdit(v, "this", { required_carers: 1 }, { series, visits });
    expect(plan.assignment_removes).toEqual([{ shift_id: v.id, carer_id: CARER_B }]);
    expect(plan.shift_updates[0].required_carers).toBe(1);
  });

  it("validates status transitions", () => {
    const { series, visits } = weeklySeries();
    expect(() => planEdit(visits[0], "this", { status: "completed" }, { series, visits })).toThrow(/cannot be changed/);
    const ok = planEdit({ ...visits[0], status: "assigned" }, "this", { status: "confirmed" }, { series, visits });
    expect(ok.plan.shift_updates[0].status).toBe("confirmed");
  });

  it("refuses to reschedule a visit that has started", () => {
    const { series, visits } = weeklySeries();
    const started = { ...visits[0], status: "in_progress" as const, actual_start: "2026-07-13T07:02:00.000Z" };
    expect(() => planEdit(started, "this", { start_time: "10:00" }, { series, visits })).toThrow(/already started/);
    // notes are still editable
    expect(planEdit(started, "this", { notes: "late" }, { series, visits }).plan.shift_updates).toHaveLength(1);
  });
});

describe("planEdit scope 'following' / 'all'", () => {
  it("'following' changes the time of this and later visits only, and updates the template", () => {
    const { series, visits } = weeklySeries();
    const { plan, affected } = planEdit(visits[1], "following", { start_time: "10:00", end_time: "10:30" }, { series, visits });
    expect(affected).toEqual([visits[1].id, visits[2].id, visits[3].id]);
    expect(plan.shift_updates.map((u) => u.id)).toEqual([visits[1].id, visits[2].id, visits[3].id]);
    expect(plan.shift_updates[0].start_time).toBe("2026-07-20T09:00:00.000Z"); // 10:00 BST
    expect(plan.series_upserts[0]).toMatchObject({ start_time: "10:00", duration_minutes: 30 });
    expect(plan.shift_updates.some((u) => u.id === visits[0].id)).toBe(false);
  });

  it("'all' changes every visit", () => {
    const { series, visits } = weeklySeries();
    const { plan } = planEdit(visits[2], "all", { start_time: "10:00" }, { series, visits });
    expect(plan.shift_updates).toHaveLength(4);
    expect(plan.series_upserts[0]).toMatchObject({ start_time: "10:00", duration_minutes: 45 }); // end omitted: duration kept
  });

  it("time changes skip exceptions but notes reach them", () => {
    const { series, visits } = weeklySeries();
    visits[2] = { ...visits[2], is_series_exception: true };
    const time = planEdit(visits[0], "all", { start_time: "10:00" }, { series, visits });
    expect(time.plan.shift_updates.map((u) => u.id)).toEqual([visits[0].id, visits[1].id, visits[3].id]);
    expect(time.skipped).toEqual([{ id: visits[2].id, reason: "moved individually; time left unchanged" }]);

    const notes = planEdit(visits[0], "all", { notes: "Dog in garden" }, { series, visits });
    expect(notes.plan.shift_updates.map((u) => u.id)).toEqual(visits.map((v) => v.id));
  });

  it("skips started and cancelled visits and says why", () => {
    const { series, visits } = weeklySeries();
    visits[1] = { ...visits[1], status: "completed", actual_start: "2026-07-20T07:00:00.000Z" };
    visits[2] = { ...visits[2], status: "cancelled" };
    const { plan, skipped } = planEdit(visits[0], "all", { notes: "x" }, { series, visits });
    expect(plan.shift_updates.map((u) => u.id)).toEqual([visits[0].id, visits[3].id]);
    expect(skipped).toEqual([{ id: visits[1].id, reason: "already started" }, { id: visits[2].id, reason: "cancelled" }]);
  });

  it("a new time is applied from the occurrence date, so a clock change in between is handled", () => {
    const { plan } = planCreate({ ...base, date: "2026-03-23", recurrence: { frequency: "weekly", repeat_every: 1, by_weekday: [], until_date: "2026-04-06" } }, { ...ctx, today: "2026-03-23" });
    const { series, visits } = materialise(plan);
    const edit = planEdit(visits[0], "all", { start_time: "09:00" }, { series, visits });
    // 23 Mar is GMT (09:00Z); 30 Mar and 6 Apr are BST (08:00Z)
    expect(edit.plan.shift_updates.map((u) => u.start_time)).toEqual(["2026-03-23T09:00:00.000Z", "2026-03-30T08:00:00.000Z", "2026-04-06T08:00:00.000Z"]);
  });

  it("changing the pattern removes visits that fall off it and keeps those that stay", () => {
    // daily for 5 days -> every 2 days: keeps days 1, 3, 5 and removes days 2 and 4
    const { plan: created } = planCreate({ ...base, recurrence: { frequency: "daily", repeat_every: 1, by_weekday: [], until_date: "2026-07-17" } }, ctx);
    const { series, visits } = materialise(created);
    const { plan } = planEdit(visits[0], "all", { recurrence: { repeat_every: 2 } }, { series, visits });
    expect(plan.shift_deletes).toEqual([visits[1].id, visits[3].id]);
    expect(plan.shift_inserts).toEqual([]);
    expect(plan.series_upserts[0].repeat_every).toBe(2);
  });

  it("changing the pattern adds missing dates up to what was already generated", () => {
    const { series, visits } = weeklySeries(); // 13, 20, 27 Jul, 3 Aug (Mondays)
    const { plan } = planEdit(visits[0], "all", { recurrence: { frequency: "custom", by_weekday: [1, 4] } }, { series, visits });
    const added = plan.shift_inserts.map((i) => i.occurrence_date);
    expect(added).toEqual(["2026-07-16", "2026-07-23", "2026-07-30"]); // the Thursdays
    expect(plan.shift_deletes).toEqual([]);
    expect(plan.shift_inserts.every((i) => i.series_id === series!.id)).toBe(true);
  });

  it("'following' with a pattern change leaves earlier visits alone", () => {
    const { plan: created } = planCreate({ ...base, recurrence: { frequency: "daily", repeat_every: 1, by_weekday: [], until_date: "2026-07-17" } }, ctx);
    const { series, visits } = materialise(created);
    const { plan } = planEdit(visits[2], "following", { recurrence: { repeat_every: 2 } }, { series, visits });
    expect(plan.shift_deletes).toEqual([visits[3].id]); // 15th stays (start of range), 16th goes, 17th stays
  });

  it("shortening the series removes later visits", () => {
    const { series, visits } = weeklySeries();
    const { plan } = planEdit(visits[0], "all", { recurrence: { until_date: "2026-07-20" } }, { series, visits });
    expect(plan.shift_deletes).toEqual([visits[2].id, visits[3].id]);
    expect(plan.series_upserts[0]).toMatchObject({ until_date: "2026-07-20", generated_until: "2026-07-20" });
  });

  it("rejects combinations that make no sense", () => {
    const { series, visits } = weeklySeries();
    expect(() => planEdit(visits[0], "all", { date: "2026-07-14" }, { series, visits })).toThrow(/scope 'this'/);
    expect(() => planEdit(visits[0], "all", { status: "cancelled" }, { series, visits })).toThrow(/scope 'this'/);
    expect(() => planEdit(visits[0], "this", { recurrence: { repeat_every: 2 } }, { series, visits })).toThrow(/following/);
    expect(() => planEdit(visits[0], "all", { recurrence: { frequency: "custom", by_weekday: [] } }, { series, visits })).toThrow(/weekday/);
  });
});

describe("selectAffected", () => {
  it("selects by scope, ordered by occurrence for 'following'", () => {
    const { visits } = weeklySeries();
    expect(selectAffected(visits, visits[2], "this").map((v) => v.id)).toEqual([visits[2].id]);
    expect(selectAffected(visits, visits[2], "following").map((v) => v.id)).toEqual([visits[2].id, visits[3].id]);
    expect(selectAffected(visits, visits[2], "all")).toHaveLength(4);
  });
});

describe("planDelete", () => {
  it("'this' deletes one visit and remembers the date so the series never regenerates it", () => {
    const { series, visits } = weeklySeries();
    const { plan } = planDelete(visits[1], "this", { series, visits });
    expect(plan.shift_deletes).toEqual([visits[1].id]);
    expect(plan.series_upserts[0].excluded_dates).toEqual(["2026-07-20"]);
  });

  it("'this' on a standalone visit is a plain delete", () => {
    const { visits } = materialise(planCreate(base, ctx).plan);
    const { plan } = planDelete(visits[0], "this", { series: null, visits });
    expect(plan).toMatchObject({ shift_deletes: [visits[0].id], series_upserts: [] });
  });

  it("refuses to delete a visit that has started", () => {
    const { series, visits } = weeklySeries();
    const started = { ...visits[0], actual_start: "2026-07-13T07:00:00.000Z", status: "in_progress" as const };
    expect(() => planDelete(started, "this", { series, visits })).toThrow(/already started/);
  });

  it("'following' deletes this and later visits and ends the series before them", () => {
    const { series, visits } = weeklySeries();
    const { plan, affected } = planDelete(visits[2], "following", { series, visits });
    expect(affected).toEqual([visits[2].id, visits[3].id]);
    expect(plan.shift_deletes).toEqual([visits[2].id, visits[3].id]);
    expect(plan.series_upserts[0]).toMatchObject({ until_date: "2026-07-20", generated_until: "2026-07-20" });
  });

  it("'all' deletes everything and removes the series", () => {
    const { series, visits } = weeklySeries();
    const { plan } = planDelete(visits[0], "all", { series, visits });
    expect(plan.shift_deletes).toHaveLength(4);
    expect(plan.series_deletes).toEqual([series!.id]);
    expect(plan.series_upserts).toEqual([]);
  });

  it("never deletes started visits; the series then ends at the last one kept", () => {
    const { series, visits } = weeklySeries();
    visits[1] = { ...visits[1], status: "completed", actual_start: "2026-07-20T07:00:00.000Z" };
    const { plan, skipped } = planDelete(visits[0], "all", { series, visits });
    expect(plan.shift_deletes).toEqual([visits[0].id, visits[2].id, visits[3].id]);
    expect(skipped).toEqual([{ id: visits[1].id, reason: "already started" }]);
    expect(plan.series_deletes).toEqual([]);
    expect(plan.series_upserts[0].until_date).toBe("2026-07-20");
  });
});
