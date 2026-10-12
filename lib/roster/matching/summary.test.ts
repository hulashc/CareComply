import { describe, expect, it } from "vitest";
import { excludedReason, shortReason, topReason } from "./summary";

describe("summary", () => {
  it("maps issue codes to short labels", () => {
    expect(shortReason("ON_LEAVE")).toBe("On leave");
    expect(shortReason("ALREADY_ASSIGNED")).toBe("Already assigned");
  });

  it("uses the first issue for an excluded carer", () => {
    const r = excludedReason({
      carer_id: "c1", full_name: "Amy",
      issues: [{ code: "ON_LEAVE", message: "Carer is on approved annual leave" }, { code: "OVERLAP", message: "x" }],
    });
    expect(r).toEqual({ short: "On leave", message: "Carer is on approved annual leave" });
    expect(excludedReason({ carer_id: "c1", full_name: "Amy", issues: [] }).short).toBe("Not available");
  });

  it("picks the first reason, then the first warning, else null", () => {
    expect(topReason({ reasons: ["Key worker", "5 min"], warnings: ["w"] })).toBe("Key worker");
    expect(topReason({ reasons: [], warnings: ["w"] })).toBe("w");
    expect(topReason({ reasons: [], warnings: [] })).toBeNull();
  });
});
