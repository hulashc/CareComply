import { describe, expect, it } from "vitest";
import { durationBetween, hhmm, matchesRule, occurrenceDates, visitWindow, type RecurrenceRule } from "./recurrence";

const rule = (over: Partial<RecurrenceRule> = {}): RecurrenceRule => ({
  frequency: "daily",
  repeat_every: 1,
  by_weekday: [],
  start_date: "2026-07-13", // a Monday
  until_date: null,
  ...over,
});

describe("occurrenceDates", () => {
  it("daily: every day, or every N days from the start date", () => {
    expect(occurrenceDates(rule(), "2026-07-13", "2026-07-16")).toEqual(["2026-07-13", "2026-07-14", "2026-07-15", "2026-07-16"]);
    expect(occurrenceDates(rule({ repeat_every: 3 }), "2026-07-13", "2026-07-22")).toEqual(["2026-07-13", "2026-07-16", "2026-07-19", "2026-07-22"]);
  });

  it("daily: counts from the start date even when the window starts later", () => {
    expect(occurrenceDates(rule({ repeat_every: 3 }), "2026-07-15", "2026-07-20")).toEqual(["2026-07-16", "2026-07-19"]);
  });

  it("weekly: same weekday as the start date, every N weeks", () => {
    const weekly = rule({ frequency: "weekly" });
    expect(occurrenceDates(weekly, "2026-07-13", "2026-08-03")).toEqual(["2026-07-13", "2026-07-20", "2026-07-27", "2026-08-03"]);
    expect(occurrenceDates({ ...weekly, repeat_every: 2 }, "2026-07-13", "2026-08-10")).toEqual(["2026-07-13", "2026-07-27", "2026-08-10"]);
  });

  it("custom: chosen weekdays, every week", () => {
    const mwf = rule({ frequency: "custom", by_weekday: [1, 3, 5] });
    expect(occurrenceDates(mwf, "2026-07-13", "2026-07-20")).toEqual(["2026-07-13", "2026-07-15", "2026-07-17", "2026-07-20"]);
  });

  it("custom: every 2 weeks counts Mon-Sun weeks from the start date's week", () => {
    // Start on a Wednesday: Mon & Wed pattern. The first week only has Wed (Mon is before the start).
    const r = rule({ frequency: "custom", by_weekday: [1, 3], repeat_every: 2, start_date: "2026-07-15" });
    expect(occurrenceDates(r, "2026-07-13", "2026-08-05")).toEqual(["2026-07-15", "2026-07-27", "2026-07-29"]);
  });

  it("stops at until_date (inclusive) and skips excluded dates", () => {
    const r = rule({ until_date: "2026-07-16" });
    expect(occurrenceDates(r, "2026-07-13", "2026-07-30", ["2026-07-14"])).toEqual(["2026-07-13", "2026-07-15", "2026-07-16"]);
  });

  it("returns nothing when the window is before the start or empty", () => {
    expect(occurrenceDates(rule(), "2026-06-01", "2026-07-12")).toEqual([]);
    expect(occurrenceDates(rule(), "2026-07-20", "2026-07-13")).toEqual([]);
  });

  it("refuses absurdly long spans", () => {
    expect(() => occurrenceDates(rule(), "2026-07-13", "2031-07-13")).toThrow(/too long/);
  });

  it("is exact across the clock changes (calendar arithmetic, no timezone)", () => {
    const r = rule({ start_date: "2026-03-27" });
    expect(occurrenceDates(r, "2026-03-27", "2026-03-31")).toEqual(["2026-03-27", "2026-03-28", "2026-03-29", "2026-03-30", "2026-03-31"]);
    expect(occurrenceDates(rule({ start_date: "2026-10-23" }), "2026-10-23", "2026-10-27")).toHaveLength(5);
  });
});

describe("matchesRule", () => {
  it("never matches before the start or after the end", () => {
    expect(matchesRule(rule({ until_date: "2026-07-20" }), "2026-07-12")).toBe(false);
    expect(matchesRule(rule({ until_date: "2026-07-20" }), "2026-07-21")).toBe(false);
    expect(matchesRule(rule({ until_date: "2026-07-20" }), "2026-07-20")).toBe(true);
  });
});

describe("durationBetween", () => {
  it("is the wall-clock difference, wrapping past midnight", () => {
    expect(durationBetween("08:00", "08:45")).toBe(45);
    expect(durationBetween("22:00", "06:00")).toBe(480);
    expect(durationBetween("23:30", "00:30")).toBe(60);
  });

  it("is 0 when start equals end (callers reject it)", () => {
    expect(durationBetween("09:00", "09:00")).toBe(0);
  });

  it("hhmm trims Postgres time values", () => {
    expect(hhmm("08:30:00")).toBe("08:30");
  });
});

describe("visitWindow (London wall-clock -> instants)", () => {
  it("keeps 08:00 at 08:00 London time through the spring clock change", () => {
    const starts = ["2026-03-28", "2026-03-29", "2026-03-30"].map((d) => visitWindow(d, "08:00", 30).start.toISOString());
    expect(starts).toEqual(["2026-03-28T08:00:00.000Z", "2026-03-29T07:00:00.000Z", "2026-03-30T07:00:00.000Z"]);
  });

  it("keeps 08:00 at 08:00 London time through the autumn clock change", () => {
    const starts = ["2026-10-24", "2026-10-25", "2026-10-26"].map((d) => visitWindow(d, "08:00", 30).start.toISOString());
    expect(starts).toEqual(["2026-10-24T07:00:00.000Z", "2026-10-25T08:00:00.000Z", "2026-10-26T08:00:00.000Z"]);
  });

  it("an overnight visit keeps its true length over a clock change", () => {
    // 22:00 Sat 28 Mar (GMT) + 8h real time = 06:00Z = 07:00 BST on Sun 29 Mar.
    const w = visitWindow("2026-03-28", "22:00", 480);
    expect(w.start.toISOString()).toBe("2026-03-28T22:00:00.000Z");
    expect(w.end.toISOString()).toBe("2026-03-29T06:00:00.000Z");
  });

  it("a series produces a stable London time across the change", () => {
    const dates = occurrenceDates(rule({ start_date: "2026-03-27" }), "2026-03-27", "2026-03-31");
    const londonHours = dates.map((d) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(visitWindow(d, "08:00", 30).start));
    expect(new Set(londonHours)).toEqual(new Set(["08:00"]));
  });
});
