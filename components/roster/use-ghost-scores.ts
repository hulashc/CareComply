"use client";

import { useEffect, useRef, useState } from "react";
import { fetchScoreMap } from "@/lib/roster-ui/api";
import { scoreKey, type CarerScore } from "@/lib/roster-ui/ghost";

/** What is being dragged, and where it would land in time. Rows do not matter: one response scores every carer. */
export interface DragPreview {
  visitId: string;
  startIso: string;
  endIso: string;
  /** The carer the visit is being dragged from, scored as a normal drop target too. */
  fromCarer: string | null;
}

export interface GhostScores {
  scores: Record<string, CarerScore>;
  /** Showing the previous slot's scores while the new slot loads. */
  stale: boolean;
}

const DEBOUNCE_MS = 120;
const DEFAULT_STEP_MS = 15 * 60_000;

/**
 * Live "ghost score" for a drag. The first slot of a drag is fetched at once; later time changes are
 * debounced; slots already fetched are shown synchronously (so moving between rows, or back to a
 * slot, is instant). While a slot loads the last scores stay up (dimmed). Any failure just means no
 * heat: the drag itself never depends on this.
 */
export function useGhostScores(preview: DragPreview | null): GhostScores | null {
  const [view, setView] = useState<{ key: string; scores: Record<string, CarerScore> } | null>(null);
  const resolved = useRef(new Map<string, Record<string, CarerScore>>());
  const current = useRef<string | null>(null);
  const active = useRef(false);
  const lastStart = useRef<number | null>(null);

  const key = preview ? scoreKey(preview.visitId, preview.startIso, preview.endIso, preview.fromCarer) : null;
  const { visitId, startIso, endIso, fromCarer } = preview ?? { visitId: "", startIso: "", endIso: "", fromCarer: null };

  useEffect(() => {
    current.current = key;
    if (!key) {
      active.current = false;
      lastStart.current = null;
      resolved.current.clear();
      setView(null);
      return;
    }
    // Direction of travel, tracked even across cached slots.
    const start = Date.parse(startIso);
    const delta = lastStart.current === null ? 0 : start - lastStart.current;
    lastStart.current = start;
    const step = delta !== 0 ? delta : DEFAULT_STEP_MS;
    const hit = resolved.current.get(key);
    if (hit) {
      setView({ key, scores: hit });
      return;
    }
    const first = !active.current;
    active.current = true;
    let cancelled = false;
    // The next slot in the direction of travel is fetched once this one has arrived, so continuing
    // the drag usually lands on a cached slot.
    const prefetch = () => {
      const dur = Date.parse(endIso) - start;
      void fetchScoreMap(visitId, new Date(start + step).toISOString(), new Date(start + step + dur).toISOString(), fromCarer).catch(() => {});
    };
    const run = () =>
      fetchScoreMap(visitId, startIso, endIso, fromCarer).then(
        (m) => {
          resolved.current.set(key, m.scores);
          if (!cancelled && current.current === key) {
            setView({ key, scores: m.scores });
            prefetch();
          }
        },
        () => {
          if (!cancelled && current.current === key) setView(null); // safe fallback: no heat
        },
      );
    if (first) {
      void run();
      return () => {
        cancelled = true;
      };
    }
    const t = setTimeout(() => void run(), DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [key, visitId, startIso, endIso, fromCarer]);

  if (!view || !key) return null;
  return { scores: view.scores, stale: view.key !== key };
}
