import { invert, type RosterCommand } from "./commands";

// Undo/redo stacks. Pure and immutable: every function returns a new History.

export interface History {
  past: RosterCommand[];
  future: RosterCommand[];
}

export const MAX_HISTORY = 100;
export const emptyHistory = (): History => ({ past: [], future: [] });

export const record = (h: History, c: RosterCommand): History => ({ past: [...h.past, c].slice(-MAX_HISTORY), future: [] });

/** The command to run to undo, and the history as it will be once that succeeds. */
export function undoStep(h: History): { run: RosterCommand; commit: History } | null {
  const last = h.past[h.past.length - 1];
  return last ? { run: invert(last), commit: { past: h.past.slice(0, -1), future: [...h.future, last] } } : null;
}

export function redoStep(h: History): { run: RosterCommand; commit: History } | null {
  const next = h.future[h.future.length - 1];
  return next ? { run: next, commit: { past: [...h.past, next], future: h.future.slice(0, -1) } } : null;
}

/** Drop entries touching ids the server says changed under us: they can no longer be replayed safely. */
export function dropTouching(h: History, ids: Set<string>): History {
  const keep = (c: RosterCommand) => ![...c.before, ...c.after].some((v) => ids.has(v.id));
  return { past: h.past.filter(keep), future: h.future.filter(keep) };
}
