import { describe, expect, it } from "vitest";
import {
  classifyTiming,
  daysBetween,
  findCarerConflicts,
  groupQualifications,
  isMissed,
  overlaps,
  reviewUrgency,
  selectUnassigned,
  summariseWeek,
  taskUrgency,
  unassignedUrgency,
  visitStatus,
  type ShiftLike,
} from "./shift-logic";

const NOW = new Date("2026-07-15T10:00:00Z");

function shift(id: string, carer: string | null, start: string, end: string, extra: Partial<ShiftLike> = {}): ShiftLike {
  return {
    id,
    carer_id: carer,
    start_time: `2026-07-15T${start}:00Z`,
    end_time: `2026-07-15T${end}:00Z`,
    status: "scheduled",
    ...extra,
  };
}

describe("overlaps", () => {
  it("treats back-to-back visits as NOT overlapping (half-open ranges)", () => {
    expect(overlaps(shift("a", "c1", "09:00", "10:00"), shift("b", "c1", "10:00", "11:00"))).toBe(false);
  });

  it("detects partial, contained and identical overlaps", () => {
    const a = shift("a", "c1", "09:00", "11:00");
    expect(overlaps(a, shift("b", "c1", "10:00", "12:00"))).toBe(true);
    expect(overlaps(a, shift("b", "c1", "09:30", "10:30"))).toBe(true);
    expect(overlaps(a, shift("b", "c1", "09:00", "11:00"))).toBe(true);
  });

  it("is false for disjoint visits", () => {
    expect(overlaps(shift("a", "c1", "09:00", "10:00"), shift("b", "c1", "12:00", "13:00"))).toBe(false);
  });
});

describe("findCarerConflicts", () => {
  it("returns the overlapping pair and the overlap window", () => {
    const result = findCarerConflicts([shift("a", "c1", "09:00", "10:00"), shift("b", "c1", "09:30", "10:30")]);
    expect(result).toHaveLength(1);
    expect(result[0].carerId).toBe("c1");
    expect([result[0].a.id, result[0].b.id]).toEqual(["a", "b"]);
    expect(result[0].overlapStart).toBe("2026-07-15T09:30:00.000Z");
    expect(result[0].overlapEnd).toBe("2026-07-15T10:00:00.000Z");
  });

  it("does not flag back-to-back visits", () => {
    expect(findCarerConflicts([shift("a", "c1", "17:00", "18:00"), shift("b", "c1", "18:00", "19:00")])).toEqual([]);
  });

  it("does not flag the same time for different carers", () => {
    expect(findCarerConflicts([shift("a", "c1", "09:00", "10:00"), shift("b", "c2", "09:00", "10:00")])).toEqual([]);
  });

  it("ignores cancelled and unassigned shifts", () => {
    const result = findCarerConflicts([
      shift("a", "c1", "09:00", "10:00"),
      shift("b", "c1", "09:00", "10:00", { status: "cancelled" }),
      shift("c", null, "09:00", "10:00"),
      shift("d", null, "09:00", "10:00"),
    ]);
    expect(result).toEqual([]);
  });

  it("finds each overlapping pair in a chain but not the non-overlapping ends", () => {
    const result = findCarerConflicts([
      shift("a", "c1", "09:00", "11:00"),
      shift("b", "c1", "10:00", "12:00"),
      shift("c", "c1", "11:00", "13:00"),
    ]);
    expect(result.map((p) => `${p.a.id}-${p.b.id}`)).toEqual(["a-b", "b-c"]);
  });

  it("finds every visit that a long visit contains", () => {
    const result = findCarerConflicts([
      shift("a", "c1", "09:00", "13:00"),
      shift("b", "c1", "10:00", "11:00"),
      shift("c", "c1", "12:00", "13:00"),
    ]);
    expect(result.map((p) => `${p.a.id}-${p.b.id}`)).toEqual(["a-b", "a-c"]);
  });

  it("handles shifts that cross midnight", () => {
    const result = findCarerConflicts([
      { ...shift("a", "c1", "23:00", "23:30"), end_time: "2026-07-16T01:00:00Z" },
      { ...shift("b", "c1", "23:30", "23:45"), start_time: "2026-07-16T00:30:00Z", end_time: "2026-07-16T02:00:00Z" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].overlapStart).toBe("2026-07-16T00:30:00.000Z");
    expect(result[0].overlapEnd).toBe("2026-07-16T01:00:00.000Z");
  });

  it("is independent of input order and sorts by earliest overlap", () => {
    const result = findCarerConflicts([
      shift("late2", "c2", "15:30", "16:30"),
      shift("early1", "c1", "08:00", "09:00"),
      shift("late1", "c2", "15:00", "16:00"),
      shift("early2", "c1", "08:30", "09:30"),
    ]);
    expect(result.map((p) => p.carerId)).toEqual(["c1", "c2"]);
  });
});

describe("selectUnassigned", () => {
  it("keeps only future, non-cancelled shifts with no carer, soonest first", () => {
    const result = selectUnassigned(
      [
        shift("later", null, "12:00", "13:00"),
        shift("running", null, "09:00", "11:00"), // started but not ended: still needs cover
        shift("ended", null, "08:00", "09:00"),
        shift("cancelled", null, "14:00", "15:00", { status: "cancelled" }),
        shift("assigned", "c1", "12:00", "13:00"),
      ],
      NOW,
    );
    expect(result.map((s) => s.id)).toEqual(["running", "later"]);
  });

  it("returns an empty list when everything is covered", () => {
    expect(selectUnassigned([shift("a", "c1", "12:00", "13:00")], NOW)).toEqual([]);
  });
});

describe("unassignedUrgency", () => {
  it("escalates by how soon the visit starts, always with a label", () => {
    expect(unassignedUrgency("2026-07-15T09:00:00Z", NOW)).toEqual({ level: "red", label: "Started" });
    expect(unassignedUrgency("2026-07-15T15:00:00Z", NOW)).toEqual({ level: "red", label: "Within 24h" });
    expect(unassignedUrgency("2026-07-17T10:00:00Z", NOW)).toEqual({ level: "amber", label: "Within 3 days" });
    expect(unassignedUrgency("2026-07-19T10:00:00Z", NOW)).toEqual({ level: "green", label: "Upcoming" });
  });
});

describe("classifyTiming", () => {
  const planned = (actual: Partial<ShiftLike>) => shift("t", "c1", "09:00", "10:00", actual);

  it("returns null when there is no check-in", () => {
    expect(classifyTiming(planned({}), NOW)).toBeNull();
  });

  it("marks a near-punctual full visit as on time", () => {
    const t = classifyTiming(planned({ actual_start: "2026-07-15T09:05:00Z", actual_end: "2026-07-15T09:58:00Z" }), NOW);
    expect(t?.urgency).toEqual({ level: "green", label: "On time" });
  });

  it("flags late arrival", () => {
    const t = classifyTiming(planned({ actual_start: "2026-07-15T09:20:00Z", actual_end: "2026-07-15T10:20:00Z" }), NOW);
    expect(t?.late).toBe(true);
    expect(t?.short).toBe(false);
    expect(t?.urgency).toEqual({ level: "amber", label: "Late 20m" });
  });

  it("flags a short visit", () => {
    const t = classifyTiming(planned({ actual_start: "2026-07-15T09:00:00Z", actual_end: "2026-07-15T09:30:00Z" }), NOW);
    expect(t?.short).toBe(true);
    expect(t?.urgency).toEqual({ level: "amber", label: "Short visit" });
  });

  it("escalates to red when both late and short", () => {
    const t = classifyTiming(planned({ actual_start: "2026-07-15T09:25:00Z", actual_end: "2026-07-15T09:55:00Z" }), NOW);
    expect(t?.urgency).toEqual({ level: "red", label: "Late & short" });
  });

  it("treats exactly 15 minutes late and exactly 80% of planned as acceptable", () => {
    const t = classifyTiming(planned({ actual_start: "2026-07-15T09:15:00Z", actual_end: "2026-07-15T10:03:00Z" }), NOW);
    expect(t?.lateMinutes).toBe(15);
    expect(t?.actualMinutes).toBe(48);
    expect(t?.late).toBe(false);
    expect(t?.short).toBe(false);
  });

  it("flags a missing check-out once the visit should have finished", () => {
    const t = classifyTiming(planned({ actual_start: "2026-07-15T09:02:00Z" }), new Date("2026-07-15T10:30:00Z"));
    expect(t?.urgency).toEqual({ level: "amber", label: "No check-out" });
  });

  it("does not flag a visit still in progress", () => {
    const t = classifyTiming(planned({ actual_start: "2026-07-15T09:02:00Z" }), new Date("2026-07-15T09:30:00Z"));
    expect(t?.urgency.level).toBe("green");
  });
});

describe("visitStatus / isMissed", () => {
  it("labels an unassigned visit as Unassigned (red)", () => {
    expect(visitStatus(shift("a", null, "12:00", "13:00"), NOW)).toEqual({ level: "red", label: "Unassigned" });
  });

  it("labels a scheduled visit past its end with no check-in as Missed", () => {
    const s = shift("a", "c1", "07:00", "08:00");
    expect(isMissed(s, NOW)).toBe(true);
    expect(visitStatus(s, NOW)).toEqual({ level: "red", label: "Missed" });
  });

  it("does not call a checked-in visit missed", () => {
    expect(isMissed(shift("a", "c1", "07:00", "08:00", { actual_start: "2026-07-15T07:00:00Z" }), NOW)).toBe(false);
  });

  it("labels completed, in-progress, cancelled and upcoming visits", () => {
    expect(visitStatus(shift("a", "c1", "07:00", "08:00", { status: "completed" }), NOW).label).toBe("Completed");
    expect(visitStatus(shift("a", "c1", "09:30", "10:30", { status: "in_progress" }), NOW).label).toBe("In progress");
    expect(visitStatus(shift("a", "c1", "12:00", "13:00", { status: "cancelled" }), NOW).label).toBe("Cancelled");
    expect(visitStatus(shift("a", "c1", "12:00", "13:00"), NOW)).toEqual({ level: "green", label: "Scheduled" });
  });

  it("flags a visit that should have started but has no check-in", () => {
    expect(visitStatus(shift("a", "c1", "09:00", "11:00"), NOW)).toEqual({ level: "amber", label: "Not started" });
  });
});

describe("summariseWeek", () => {
  it("counts visits, hours, completed and missed, ignoring cancelled", () => {
    const summary = summariseWeek(
      [
        shift("a", "c1", "07:00", "08:00", { status: "completed" }),
        shift("b", "c1", "08:00", "09:30"), // scheduled, past, no check-in → missed
        shift("c", "c1", "12:00", "13:00"), // upcoming
        shift("d", "c1", "12:00", "13:00", { status: "cancelled" }),
      ],
      NOW,
    );
    expect(summary).toEqual({ visits: 3, plannedHours: 3.5, completed: 1, missed: 1 });
  });

  it("is all zeros for an empty week", () => {
    expect(summariseWeek([], NOW)).toEqual({ visits: 0, plannedHours: 0, completed: 0, missed: 0 });
  });
});

describe("date-only urgency", () => {
  const today = "2026-07-15";

  it("daysBetween is signed and DST-safe", () => {
    expect(daysBetween(today, "2026-07-16")).toBe(1);
    expect(daysBetween(today, "2026-07-10")).toBe(-5);
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
  });

  it("reviewUrgency", () => {
    expect(reviewUrgency("2026-07-09", today)).toEqual({ level: "red", label: "Overdue 6d" });
    expect(reviewUrgency("2026-07-15", today)).toEqual({ level: "amber", label: "Due today" });
    expect(reviewUrgency("2026-07-29", today)).toEqual({ level: "amber", label: "Due in 14d" });
    expect(reviewUrgency("2026-07-30", today)).toEqual({ level: "green", label: "On track" });
  });

  it("taskUrgency", () => {
    expect(taskUrgency(null, today)).toEqual({ level: "green", label: "No due date" });
    expect(taskUrgency("2026-07-13", today)).toEqual({ level: "red", label: "Overdue 2d" });
    expect(taskUrgency("2026-07-15", today)).toEqual({ level: "amber", label: "Due today" });
    expect(taskUrgency("2026-07-17", today)).toEqual({ level: "amber", label: "Due in 2d" });
    expect(taskUrgency("2026-07-25", today)).toEqual({ level: "green", label: "Due in 10d" });
  });
});

describe("groupQualifications", () => {
  const today = "2026-07-15";

  it("groups by type, drops far-future and undated records, most urgent first", () => {
    const groups = groupQualifications(
      [
        { carer_id: "a", qualification_type: "Moving & Handling", expiry_date: "2026-06-01" }, // expired
        { carer_id: "b", qualification_type: "Moving & Handling", expiry_date: "2026-07-25" }, // 10d
        { carer_id: "c", qualification_type: "First Aid", expiry_date: "2026-08-10" }, // 26d
        { carer_id: "d", qualification_type: "Safeguarding", expiry_date: "2026-09-30" }, // too far
        { carer_id: "e", qualification_type: "Dementia Care", expiry_date: null },
      ],
      today,
    );
    expect(groups.map((g) => g.type)).toEqual(["Moving & Handling", "First Aid"]);
    expect(groups[0]).toMatchObject({ expired: 1, expiring: 1, mostUrgentCarerId: "a" });
    expect(groups[0].urgency).toEqual({ level: "red", label: "1 expired · 1 due" });
    expect(groups[1].urgency).toEqual({ level: "amber", label: "1 due" });
  });

  it("returns nothing when all qualifications are in date", () => {
    expect(groupQualifications([{ carer_id: "a", qualification_type: "First Aid", expiry_date: "2027-01-01" }], today)).toEqual([]);
  });
});
