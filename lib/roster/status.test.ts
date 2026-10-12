import { describe, expect, it } from "vitest";
import { canSetStatus, deriveStatus, isStarted } from "./status";

describe("deriveStatus (mirrors the database trigger)", () => {
  it("is unassigned until every required carer is on, then assigned", () => {
    expect(deriveStatus("assigned", 0, 1)).toBe("unassigned");
    expect(deriveStatus("unassigned", 1, 1)).toBe("assigned");
  });

  it("a double-up with one carer is still unassigned", () => {
    expect(deriveStatus("assigned", 1, 2)).toBe("unassigned");
    expect(deriveStatus("unassigned", 2, 2)).toBe("assigned");
  });

  it("keeps confirmed while fully staffed, drops it when not", () => {
    expect(deriveStatus("confirmed", 1, 1)).toBe("confirmed");
    expect(deriveStatus("confirmed", 1, 2)).toBe("unassigned");
  });

  it("never changes in_progress, completed or cancelled", () => {
    for (const s of ["in_progress", "completed", "cancelled"] as const) expect(deriveStatus(s, 0, 1)).toBe(s);
  });

  it("maps the pre-rostering 'scheduled' status", () => {
    expect(deriveStatus("scheduled", 1, 1)).toBe("assigned");
    expect(deriveStatus("scheduled", 0, 1)).toBe("unassigned");
  });
});

describe("canSetStatus", () => {
  it("allows the normal lifecycle", () => {
    expect(canSetStatus("assigned", "confirmed").ok).toBe(true);
    expect(canSetStatus("confirmed", "in_progress").ok).toBe(true);
    expect(canSetStatus("in_progress", "completed").ok).toBe(true);
    expect(canSetStatus("unassigned", "cancelled").ok).toBe(true);
  });

  it("allows unconfirming and reopening via 'assigned' (the database derives the real value)", () => {
    expect(canSetStatus("confirmed", "assigned").ok).toBe(true);
    expect(canSetStatus("cancelled", "assigned").ok).toBe(true);
  });

  it("never allows setting 'unassigned' directly", () => {
    const r = canSetStatus("assigned", "unassigned");
    expect(r.ok).toBe(false);
  });

  it("completed is final; an unstaffed visit cannot start", () => {
    expect(canSetStatus("completed", "assigned").ok).toBe(false);
    expect(canSetStatus("unassigned", "in_progress").ok).toBe(false);
    expect(canSetStatus("unassigned", "confirmed").ok).toBe(false);
  });

  it("is a no-op to set the current status", () => {
    expect(canSetStatus("completed", "completed").ok).toBe(true);
  });
});

describe("isStarted", () => {
  it("is true once checked in, in progress or completed", () => {
    expect(isStarted({ status: "assigned", actual_start: "2026-07-15T09:00:00Z" })).toBe(true);
    expect(isStarted({ status: "in_progress", actual_start: null })).toBe(true);
    expect(isStarted({ status: "completed", actual_start: null })).toBe(true);
    expect(isStarted({ status: "assigned", actual_start: null })).toBe(false);
    expect(isStarted({ status: "cancelled", actual_start: null })).toBe(false);
  });
});
