// Pure layout helpers for the roster grids.

export interface Placed<T> {
  item: T;
  lane: number;
}

/**
 * Pack overlapping intervals into the fewest lanes (greedy by start time). Back-to-back items
 * (end == next start) share a lane. Used so a double-booked carer, or a client with two overlapping
 * visits, stays readable instead of drawing blocks on top of each other.
 */
export function packLanes<T extends { start: number; end: number }>(items: T[]): { placed: Placed<T>[]; lanes: number } {
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end);
  const laneEnds: number[] = [];
  const placed: Placed<T>[] = [];
  for (const item of sorted) {
    let lane = laneEnds.findIndex((end) => end <= item.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.end);
    } else {
      laneEnds[lane] = item.end;
    }
    placed.push({ item, lane });
  }
  return { placed, lanes: laneEnds.length };
}

/** Horizontal position of an instant on a time axis that starts at `axisStart` (ms), in px. */
export function xOf(ms: number, axisStart: number, pxPerHour: number): number {
  return ((ms - axisStart) / 3_600_000) * pxPerHour;
}

/** Items whose [left, right] px span intersects [from, to]; the horizontal virtualization window. */
export function inWindow<T extends { left: number; right: number }>(items: T[], from: number, to: number): T[] {
  return items.filter((i) => i.right >= from && i.left <= to);
}

/** Index range [first, last] of fixed-height rows visible in a scroll window, with overscan. */
export function fixedRowWindow(scrollTop: number, viewport: number, rowHeight: number, count: number, overscan = 6): [number, number] {
  if (count === 0) return [0, -1];
  const first = Math.min(count - 1, Math.max(0, Math.floor(scrollTop / rowHeight) - overscan));
  const last = Math.min(count - 1, Math.ceil((scrollTop + viewport) / rowHeight) + overscan);
  return [first, last];
}
