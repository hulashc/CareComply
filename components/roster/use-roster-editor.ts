"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { formatLondonTime } from "@/lib/dates/london";
import { EditError, patchVisit, postBatch, type EditIssue, type SnapInput } from "@/lib/roster-ui/api";
import {
  applyCommand,
  cmd,
  copyPreviousWeek,
  duplicateTo,
  pasteAt,
  reassign,
  revertCommand,
  unassign,
  type CarerRef,
  type RosterCommand,
} from "@/lib/roster-ui/commands";
import { detectConflicts, type Conflict } from "@/lib/roster-ui/conflicts";
import { dropTouching, emptyHistory, record, redoStep, undoStep, type History } from "@/lib/roster-ui/history";
import type { RosterCarer } from "@/lib/roster-ui/types";
import type { VisitRow } from "@/lib/roster/types";

// The editing engine. Owns: optimistic apply -> serialized save -> reconcile or roll back, undo/redo,
// selection and clipboard. The calendar only builds RosterCommands (lib/roster-ui/commands.ts) and
// hands them to `act`.
//
// Safety rules:
//  - saves run ONE AT A TIME in order, so an undo can never overtake the change it undoes;
//  - the server's `updated_at` for each visit is remembered and sent back, so a visit someone else
//    changed is rejected (STALE) instead of overwritten;
//  - any failure reverts the optimistic change; stale / network failures also reload from the server.

export interface Toast {
  text: string;
  tone: "error" | "info";
}

/** saved; prompt = waiting for an override reason; refused = impossible, nothing changed; failed = rolled back. */
export type ActResult = "saved" | "prompt" | "refused" | "failed";

export interface OverridePrompt {
  cmd: RosterCommand;
  items: { message: string; blocking: boolean }[];
}

interface Options {
  visits: VisitRow[];
  setVisits: (fn: (prev: VisitRow[]) => VisitRow[]) => void;
  carers: RosterCarer[];
  snap: number;
  /** Authoritative reload of the visible range. */
  reload: () => void;
}

type Kind = "do" | "undo" | "redo";
interface ExecOpts {
  kind: Kind;
  force?: boolean;
  reason?: string;
}

const toSnap = (v: VisitRow, version: string | null): SnapInput => ({
  id: v.id,
  client_id: v.client_id,
  location_id: v.location_id,
  start_time: v.start_time,
  end_time: v.end_time,
  required_carers: v.required_carers,
  required_skills: v.required_skills ?? [],
  notes: v.notes,
  roster_state: v.roster_state,
  carer_ids: [...v.carers].sort((a, b) => a.slot - b.slot).map((c) => c.carer_id),
  series_id: v.series_id,
  occurrence_date: v.occurrence_date,
  updated_at: version,
});

const key = (c: Conflict) => `${c.code}:${c.carer_id ?? ""}`;

export function useRosterEditor(o: Options) {
  const { setVisits, reload } = o;
  const visitsRef = useRef(o.visits);
  visitsRef.current = o.visits;
  const carersRef = useRef(o.carers);
  carersRef.current = o.carers;

  const versions = useRef(new Map<string, string>());
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const touching = useRef(new Map<string, number>());
  const histRef = useRef<History>(emptyHistory());
  const [history, setHistoryState] = useState<History>(emptyHistory());
  const [saving, setSaving] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);
  const [override, setOverride] = useState<OverridePrompt | null>(null);
  const [selection, setSelection] = useState<ReadonlySet<string>>(new Set());
  const [clipboard, setClipboard] = useState<VisitRow[]>([]);

  const setHistory = useCallback((h: History) => {
    histRef.current = h;
    setHistoryState(h);
  }, []);

  /** Remember the server version of freshly loaded / saved rows (the stale guard). */
  const seed = useCallback((rows: VisitRow[]) => {
    for (const r of rows) versions.current.set(r.id, r.updated_at);
  }, []);

  const touch = (c: RosterCommand, d: 1 | -1) => {
    for (const v of [...c.before, ...c.after]) touching.current.set(v.id, Math.max(0, (touching.current.get(v.id) ?? 0) + d));
  };

  const send = async (c: RosterCommand, e: ExecOpts) => {
    const afterIds = new Set(c.after.map((v) => v.id));
    // Recurring edits (this / following / all) go through the series planner.
    if (c.scope && c.scope !== "this" && c.after.length === 1 && c.before.length === 1) {
      const a = c.after[0];
      const b = c.before[0];
      const patch: Record<string, unknown> = { scope: c.scope };
      if (a.start_time !== b.start_time) patch.start_time = formatLondonTime(a.start_time);
      if (a.end_time !== b.end_time) patch.end_time = formatLondonTime(a.end_time);
      if ((a.notes ?? null) !== (b.notes ?? null)) patch.notes = a.notes;
      if (a.required_carers !== b.required_carers) patch.required_carers = a.required_carers;
      if (a.required_skills.join() !== b.required_skills.join()) patch.required_skills = a.required_skills;
      await patchVisit(a.id, patch);
      reload();
      return;
    }
    const res = await postBatch({
      upserts: c.after.map((v) => toSnap(v, versions.current.get(v.id) ?? null)),
      deletes: c.before.filter((v) => !afterIds.has(v.id)).map((v) => ({ id: v.id, updated_at: versions.current.get(v.id) ?? null })),
      force: e.force,
      reason: e.force ? (e.reason ?? "Override") : undefined,
      label: c.label,
    });
    for (const id of res.deleted) versions.current.delete(id);
    seed(res.visits);
    // Replace optimistic rows with the server's, except rows another queued change is still editing.
    // (count > 1 means a later queued change also touches the row; decided now, not inside the updater.)
    const fresh = new Map(res.visits.filter((v) => (touching.current.get(v.id) ?? 0) <= 1).map((v) => [v.id, v]));
    setVisits((prev) => prev.map((v) => fresh.get(v.id) ?? v));
  };

  /** Apply optimistically, save in order, reconcile. Resolves true when saved. */
  const exec = useCallback(
    (c: RosterCommand, e: ExecOpts): Promise<boolean> => {
      const prevHistory = histRef.current;
      setVisits((rows) => applyCommand(rows, c));
      touch(c, 1);
      setSaving((n) => n + 1);

      const job = async (): Promise<boolean> => {
        try {
          await send(c, e);
          return true;
        } catch (err) {
          setVisits((rows) => revertCommand(rows, c));
          const ee = err instanceof EditError ? err : new EditError("Something went wrong; the change was not saved", null);
          setHistory(prevHistory);
          if (ee.code === "OVERRIDE_REQUIRED" && e.kind === "do") {
            setOverride({ cmd: c, items: ee.issues.flatMap((i: EditIssue) => i.issues.map((x) => ({ message: x.message, blocking: false }))) });
          } else if (ee.code === "STALE") {
            setHistory(dropTouching(histRef.current, new Set(ee.ids)));
            setToast({ text: "Someone else changed that visit, so the roster was refreshed. Try again.", tone: "error" });
            reload();
          } else {
            setToast({ text: ee.message, tone: "error" });
            if (ee.code === "NETWORK" || ee.code === null) reload();
          }
          return false;
        } finally {
          touch(c, -1);
          setSaving((n) => n - 1);
        }
      };
      const next = queue.current.then(job, job);
      queue.current = next;
      return next;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setVisits, reload, setHistory],
  );

  /** New conflicts a command would introduce (ones the visits did not already have). */
  const newConflicts = (c: RosterCommand): Conflict[] => {
    const rows = visitsRef.current;
    const ids = new Set(c.after.map((v) => v.id));
    const before = detectConflicts(rows, carersRef.current);
    const after = detectConflicts(applyCommand(rows, c), carersRef.current);
    const out: Conflict[] = [];
    for (const id of ids) {
      const had = new Set((before.get(id) ?? []).map(key));
      for (const x of after.get(id) ?? []) if (!had.has(key(x))) out.push(x);
    }
    return out;
  };

  /** Run a user edit. Impossible changes are refused; conflicting ones ask for a reason first. */
  const act = useCallback(
    async (c: RosterCommand, opts: { force?: boolean; reason?: string } = {}): Promise<ActResult> => {
      if (c.before.length === 0 && c.after.length === 0) return "refused";
      if (!opts.force) {
        const fresh = newConflicts(c);
        const blocking = fresh.find((x) => x.blocking);
        if (blocking) {
          setToast({ text: `${blocking.message}. That can't be overridden.`, tone: "error" });
          return "refused";
        }
        if (fresh.length > 0) {
          setOverride({ cmd: c, items: fresh.map((x) => ({ message: x.message, blocking: false })) });
          return "prompt";
        }
      }
      setHistory(record(histRef.current, c));
      return (await exec(c, { kind: "do", force: opts.force, reason: opts.reason })) ? "saved" : "failed";
    },
    [exec, setHistory],
  );

  const confirmOverride = useCallback(
    (reason: string) => {
      if (!override) return;
      const c = override.cmd;
      setOverride(null);
      void act(c, { force: true, reason });
    },
    [override, act],
  );

  const undo = useCallback(() => {
    const step = undoStep(histRef.current);
    if (!step) return;
    setHistory(step.commit);
    void exec(step.run, { kind: "undo", force: true, reason: "Undo" });
  }, [exec, setHistory]);

  const redo = useCallback(() => {
    const step = redoStep(histRef.current);
    if (!step) return;
    setHistory(step.commit);
    void exec(step.run, { kind: "redo", force: true, reason: "Redo" });
  }, [exec, setHistory]);

  // ── selection ──
  const select = useCallback((id: string, mode: "replace" | "toggle") => {
    setSelection((prev) => {
      if (mode === "replace") return new Set([id]);
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const clearSelection = useCallback(() => setSelection(new Set()), []);

  const selected = useCallback(() => visitsRef.current.filter((v) => selection.has(v.id)), [selection]);

  // ── bulk actions on the selection ──
  const deleteSelected = useCallback(() => {
    const rows = selected();
    if (rows.length === 0) return;
    void act(cmd(rows.length === 1 ? "Delete visit" : `Delete ${rows.length} visits`, rows, []));
    setSelection(new Set());
  }, [selected, act]);

  const reassignSelected = useCallback(
    (to: CarerRef) => {
      const rows = selected();
      if (rows.length === 0) return;
      void act(cmd(`Reassign ${rows.length} visit${rows.length > 1 ? "s" : ""} to ${to.full_name}`, rows, rows.map((v) => reassign(v, to))));
    },
    [selected, act],
  );

  const unassignSelected = useCallback(() => {
    const rows = selected().filter((v) => v.carers.length > 0);
    if (rows.length === 0) return;
    void act(cmd(`Unassign ${rows.length} visit${rows.length > 1 ? "s" : ""}`, rows, rows.map((v) => v.carers.reduce((acc, c) => unassign(acc, c.carer_id), v))));
  }, [selected, act]);

  const duplicateSelected = useCallback(
    (dayOffsets: number[]) => {
      const rows = selected();
      if (rows.length === 0 || dayOffsets.length === 0) return;
      const copies = duplicateTo(rows, dayOffsets);
      void act(cmd(`Duplicate ${rows.length} visit${rows.length > 1 ? "s" : ""}`, [], copies));
      setSelection(new Set(copies.map((v) => v.id)));
    },
    [selected, act],
  );

  const copy = useCallback(() => {
    const rows = selected();
    if (rows.length === 0) return;
    setClipboard(rows);
    setToast({ text: `Copied ${rows.length} visit${rows.length > 1 ? "s" : ""}`, tone: "info" });
  }, [selected]);

  const paste = useCallback(
    (atMs: number, carer?: CarerRef) => {
      const copies = pasteAt(clipboard, atMs, o.snap, carer);
      if (copies.length === 0) return;
      void act(cmd(`Paste ${copies.length} visit${copies.length > 1 ? "s" : ""}`, [], copies));
      setSelection(new Set(copies.map((v) => v.id)));
    },
    [clipboard, act, o.snap],
  );

  /** Copy the one-off visits of [prevStartMs, prevEndMs) forward one week. */
  const copyPrevWeek = useCallback(
    (prevStartMs: number, prevEndMs: number) => {
      const prev = visitsRef.current.filter((v) => Date.parse(v.start_time) >= prevStartMs && Date.parse(v.start_time) < prevEndMs);
      const copies = copyPreviousWeek(prev);
      if (copies.length === 0) {
        setToast({ text: "No one-off visits found in the previous week (recurring visits already repeat).", tone: "info" });
        return;
      }
      void act(cmd(`Copy previous week (${copies.length} visits)`, [], copies));
    },
    [act],
  );

  return useMemo(
    () => ({
      act,
      undo,
      redo,
      seed,
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
      undoLabel: history.past[history.past.length - 1]?.label ?? null,
      redoLabel: history.future[history.future.length - 1]?.label ?? null,
      saving: saving > 0,
      toast,
      dismissToast: () => setToast(null),
      notify: (text: string, tone: Toast["tone"] = "info") => setToast({ text, tone }),
      override,
      confirmOverride,
      cancelOverride: () => setOverride(null),
      selection,
      select,
      setSelection,
      clearSelection,
      clipboard,
      deleteSelected,
      reassignSelected,
      unassignSelected,
      duplicateSelected,
      copy,
      paste,
      copyPrevWeek,
    }),
    [act, undo, redo, seed, history, saving, toast, override, confirmOverride, selection, select, clearSelection, clipboard, deleteSelected, reassignSelected, unassignSelected, duplicateSelected, copy, paste, copyPrevWeek],
  );
}

export type RosterEditor = ReturnType<typeof useRosterEditor>;
