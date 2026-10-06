import { describe, expect, it } from "vitest";
import {
  addDays,
  daysFromLondonToday,
  formatLondonTime,
  londonDayRange,
  londonHour,
  londonMidnight,
  londonParts,
  londonToday,
  londonWeekRange,
} from "./london";

const iso = (d: Date) => d.toISOString();

describe("londonMidnight", () => {
  it("is 00:00Z in winter (GMT)", () => {
    expect(iso(londonMidnight({ year: 2026, month: 1, day: 15 }))).toBe("2026-01-15T00:00:00.000Z");
  });

  it("is 23:00Z the previous day in summer (BST)", () => {
    expect(iso(londonMidnight({ year: 2026, month: 7, day: 15 }))).toBe("2026-07-14T23:00:00.000Z");
  });
});

describe("londonDayRange", () => {
  it("uses the London date, not the UTC date, around midnight", () => {
    // 23:30Z on 14 July is 00:30 BST on 15 July
    const r = londonDayRange(0, new Date("2026-07-14T23:30:00Z"));
    expect(r.date).toBe("2026-07-15");
    expect(iso(r.start)).toBe("2026-07-14T23:00:00.000Z");
    expect(iso(r.end)).toBe("2026-07-15T23:00:00.000Z");
  });

  it("offsets to tomorrow", () => {
    expect(londonDayRange(1, new Date("2026-07-15T12:00:00Z")).date).toBe("2026-07-16");
  });

  it("is 23 hours long on the spring-forward day", () => {
    const r = londonDayRange(0, new Date("2026-03-29T12:00:00Z"));
    expect((r.end.getTime() - r.start.getTime()) / 3_600_000).toBe(23);
  });

  it("is 25 hours long on the fall-back day", () => {
    const r = londonDayRange(0, new Date("2026-10-25T12:00:00Z"));
    expect((r.end.getTime() - r.start.getTime()) / 3_600_000).toBe(25);
  });
});

describe("londonWeekRange", () => {
  it("runs Monday to Monday for a midweek date", () => {
    // Wednesday 15 July 2026
    const r = londonWeekRange(new Date("2026-07-15T12:00:00Z"));
    expect(r.startDate).toBe("2026-07-13");
    expect(r.endDate).toBe("2026-07-19");
    expect(iso(r.start)).toBe("2026-07-12T23:00:00.000Z");
    expect(iso(r.end)).toBe("2026-07-19T23:00:00.000Z");
  });

  it("treats Sunday as the last day of the week", () => {
    expect(londonWeekRange(new Date("2026-07-19T10:00:00Z")).startDate).toBe("2026-07-13");
  });

  it("treats Monday as the first day of the week", () => {
    expect(londonWeekRange(new Date("2026-07-13T10:00:00Z")).startDate).toBe("2026-07-13");
  });
});

describe("londonParts / londonHour", () => {
  it("applies BST in summer and GMT in winter", () => {
    expect(londonHour(new Date("2026-07-15T22:30:00Z"))).toBe(23);
    expect(londonHour(new Date("2026-01-15T22:30:00Z"))).toBe(22);
  });

  it("reports midnight as hour 0, not 24", () => {
    expect(londonParts(new Date("2026-01-15T00:05:00Z")).hour).toBe(0);
  });

  it("reports an ISO weekday (Mon=1 … Sun=7)", () => {
    expect(londonParts(new Date("2026-07-15T12:00:00Z")).weekday).toBe(3);
    expect(londonParts(new Date("2026-07-19T12:00:00Z")).weekday).toBe(7);
  });
});

describe("helpers", () => {
  it("addDays rolls over months and years", () => {
    expect(addDays({ year: 2026, month: 12, day: 31 }, 1)).toEqual({ year: 2027, month: 1, day: 1 });
    expect(addDays({ year: 2026, month: 3, day: 1 }, -1)).toEqual({ year: 2026, month: 2, day: 28 });
  });

  it("londonToday follows the London calendar", () => {
    expect(londonToday(new Date("2026-07-14T23:30:00Z"))).toEqual({ year: 2026, month: 7, day: 15 });
  });

  it("daysFromLondonToday is signed", () => {
    const now = new Date("2026-07-14T23:30:00Z"); // 15 July in London
    expect(daysFromLondonToday("2026-07-16", now)).toBe(1);
    expect(daysFromLondonToday("2026-07-10", now)).toBe(-5);
  });

  it("formatLondonTime renders London wall-clock time", () => {
    expect(formatLondonTime("2026-07-15T08:30:00Z")).toBe("09:30");
    expect(formatLondonTime("2026-01-15T08:30:00Z")).toBe("08:30");
  });
});
