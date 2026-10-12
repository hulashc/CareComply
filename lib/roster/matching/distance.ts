import type { TransportMode } from "../types";

// Travel estimates. The engine is synchronous and pure, so a real routing service (Google,
// OSRM, ...) plugs in as a DistanceService whose answers the caller has already fetched or
// cached; anything it cannot answer falls back to straight-line distance.

export interface LatLng {
  lat: number;
  lng: number;
}

export interface TravelEstimate {
  km: number;
  minutes: number;
}

export interface DistanceService {
  /** null = "don't know"; the fallback is used instead. */
  estimate(from: LatLng, to: LatLng, mode: TransportMode | null): TravelEstimate | null;
}

/** Roads are not straight lines: haversine distance is scaled up by this. */
export const ROAD_FACTOR = 1.3;

/** Average door-to-door urban speeds, km/h. */
export const SPEED_KMH: Record<TransportMode, number> = {
  car: 30,
  public_transport: 15,
  bicycle: 14,
  walking: 5,
};

const EARTH_RADIUS_KM = 6371;
const rad = (deg: number) => (deg * Math.PI) / 180;

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Haversine × road factor at the mode's speed; an unknown mode is treated as public transport. */
export const fallbackDistance: DistanceService = {
  estimate(from, to, mode) {
    const km = haversineKm(from, to) * ROAD_FACTOR;
    return { km, minutes: (km / SPEED_KMH[mode ?? "public_transport"]) * 60 };
  },
};

/** The given service, falling back to haversine when it has no answer or fails. */
export function withFallback(service: DistanceService | undefined): DistanceService {
  if (!service) return fallbackDistance;
  return {
    estimate(from, to, mode) {
      try {
        const hit = service.estimate(from, to, mode);
        if (hit && Number.isFinite(hit.km) && Number.isFinite(hit.minutes)) return hit;
      } catch {
        // A routing outage must not break matching.
      }
      return fallbackDistance.estimate(from, to, mode);
    },
  };
}
