import { describe, expect, it } from "vitest";
import { ROAD_FACTOR, SPEED_KMH, fallbackDistance, haversineKm, withFallback, type DistanceService } from "./distance";

const A = { lat: 51.5, lng: -0.1 };
const B = { lat: 51.6, lng: -0.1 }; // 0.1° north ≈ 11.12 km

describe("haversineKm", () => {
  it("is zero for the same point and symmetric", () => {
    expect(haversineKm(A, A)).toBe(0);
    expect(haversineKm(A, B)).toBeCloseTo(haversineKm(B, A), 10);
  });

  it("matches a known distance", () => {
    expect(haversineKm(A, B)).toBeCloseTo(11.12, 1);
  });
});

describe("fallbackDistance", () => {
  it("applies the road factor and a per-mode speed", () => {
    const car = fallbackDistance.estimate(A, B, "car")!;
    expect(car.km).toBeCloseTo(haversineKm(A, B) * ROAD_FACTOR, 6);
    expect(car.minutes).toBeCloseTo((car.km / SPEED_KMH.car) * 60, 6);
    const walk = fallbackDistance.estimate(A, B, "walking")!;
    expect(walk.minutes).toBeGreaterThan(car.minutes);
  });

  it("treats an unknown mode as public transport", () => {
    expect(fallbackDistance.estimate(A, B, null)).toEqual(fallbackDistance.estimate(A, B, "public_transport"));
  });
});

describe("withFallback", () => {
  it("prefers the pluggable service and falls back when it has no answer", () => {
    const service: DistanceService = { estimate: (from) => (from.lat === A.lat ? { km: 1, minutes: 3 } : null) };
    const combined = withFallback(service);
    expect(combined.estimate(A, B, "car")).toEqual({ km: 1, minutes: 3 });
    expect(combined.estimate(B, A, "car")).toEqual(fallbackDistance.estimate(B, A, "car"));
  });

  it("falls back when the service throws", () => {
    const broken: DistanceService = { estimate: () => { throw new Error("quota"); } };
    expect(withFallback(broken).estimate(A, B, "car")).toEqual(fallbackDistance.estimate(A, B, "car"));
  });

  it("is the fallback itself when no service is given", () => {
    expect(withFallback(undefined).estimate(A, B, "car")).toEqual(fallbackDistance.estimate(A, B, "car"));
  });
});
