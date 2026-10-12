import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchScoreMap, invalidate } from "./api";
import { heatColor, pct, scoreKey } from "./ghost";

afterEach(() => {
  invalidate();
  vi.unstubAllGlobals();
});

describe("heatColor", () => {
  it("runs red to green and clamps", () => {
    expect(heatColor(0)).toBe("hsl(0 75% 45% / 0.28)");
    expect(heatColor(100)).toBe("hsl(130 75% 45% / 0.28)");
    expect(heatColor(-20)).toBe(heatColor(0));
    expect(heatColor(250)).toBe(heatColor(100));
    expect(pct(81.6)).toBe("82%");
  });
});

describe("fetchScoreMap", () => {
  const stub = () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ visit_id: "v", start_time: "", end_time: "", scores: {} }) }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  };

  it("keys by instant, so equivalent timestamps share a slot", () => {
    expect(scoreKey("v", "2026-07-14T09:00:00+01:00", "2026-07-14T10:00:00+01:00", null)).toBe(
      scoreKey("v", "2026-07-14T08:00:00Z", "2026-07-14T09:00:00Z", null),
    );
    expect(scoreKey("v", "2026-07-14T08:00:00Z", "2026-07-14T09:00:00Z", "c1")).not.toBe(scoreKey("v", "2026-07-14T08:00:00Z", "2026-07-14T09:00:00Z", null));
  });

  it("de-duplicates concurrent and repeated requests for a slot, until invalidated", async () => {
    const f = stub();
    const a = fetchScoreMap("v", "2026-07-14T08:00:00Z", "2026-07-14T09:00:00Z", "c1");
    const b = fetchScoreMap("v", "2026-07-14T08:00:00.000Z", "2026-07-14T09:00:00Z", "c1");
    await Promise.all([a, b]);
    await fetchScoreMap("v", "2026-07-14T08:00:00Z", "2026-07-14T09:00:00Z", "c1");
    expect(f).toHaveBeenCalledTimes(1);
    await fetchScoreMap("v", "2026-07-14T08:15:00Z", "2026-07-14T09:15:00Z", "c1");
    expect(f).toHaveBeenCalledTimes(2);
    invalidate();
    await fetchScoreMap("v", "2026-07-14T08:00:00Z", "2026-07-14T09:00:00Z", "c1");
    expect(f).toHaveBeenCalledTimes(3);
  });

  it("does not cache failures", async () => {
    const f = vi.fn().mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    f.mockResolvedValue({ ok: true, json: async () => ({ scores: {} }) });
    vi.stubGlobal("fetch", f);
    await expect(fetchScoreMap("v", "2026-07-14T08:00:00Z", "2026-07-14T09:00:00Z", null)).rejects.toThrow();
    await expect(fetchScoreMap("v", "2026-07-14T08:00:00Z", "2026-07-14T09:00:00Z", null)).resolves.toBeTruthy();
  });
});
