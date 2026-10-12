export const SNAPS = [5, 15, 30] as const;
export type Snap = (typeof SNAPS)[number];

/** Round an instant (ms) to the nearest `minutes` boundary. */
export function snapMs(ms: number, minutes: number): number {
  const step = minutes * 60_000;
  return Math.round(ms / step) * step;
}

/** Inverse of xOf: pixels along the axis to an instant (ms). */
export function msAt(px: number, axisStart: number, pxPerHour: number): number {
  return axisStart + (px / pxPerHour) * 3_600_000;
}
