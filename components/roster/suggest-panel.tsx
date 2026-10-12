"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { formatLondonShortDate } from "@/lib/dates/london";
import { fetchSuggestions } from "@/lib/roster-ui/api";
import type { CarerRef } from "@/lib/roster-ui/commands";
import { FACTOR_LABELS, heatColor, pct, type SuggestionsResponse } from "@/lib/roster-ui/ghost";
import { WEIGHT_KEYS } from "@/lib/roster/weights";
import type { VisitRow } from "@/lib/roster/types";
import { cn } from "@/lib/utils";
import { CompareView } from "./compare-view";
import { timeRange } from "./format";
import type { ActResult } from "./use-roster-editor";

// "Suggest carers": the matching engine's top 3 for one visit (match %, factor breakdown, reasons,
// warnings), a side-by-side compare view, the carers that were filtered out and why, and one-click
// Assign through the same undoable command path as drag-and-drop.

type Candidate = SuggestionsResponse["candidates"][number];
type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: SuggestionsResponse };

interface Props {
  visit: VisitRow;
  /** Assign a carer to the visit; resolves with the editor's result. */
  onAssign: (carer: CarerRef) => Promise<ActResult>;
  onClose: () => void;
}

export function SuggestPanel({ visit, onAssign, onClose }: Props) {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [compare, setCompare] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => closeRef.current?.focus(), []);

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: "loading" });
    fetchSuggestions(visit.id, 3).then(
      (data) => !cancelled && setLoad({ status: "ready", data }),
      (e: unknown) => !cancelled && setLoad({ status: "error", message: e instanceof Error ? e.message : "Could not load suggestions" }),
    );
    return () => {
      cancelled = true;
    };
  }, [visit.id, attempt]);

  // With every slot filled, Assign swaps out the last carer (the same rule as drag-and-drop).
  const replaced = visit.open_slots > 0 || visit.carers.length === 0 ? null : visit.carers[visit.carers.length - 1];
  const assignLabel = (c: Candidate) => (replaced ? `Replace ${replaced.full_name.split(" ")[0]}` : `Assign ${c.full_name.split(" ")[0]}`);

  const assign = async (c: Candidate) => {
    setAssigning(c.carer_id);
    const result = await onAssign({ carer_id: c.carer_id, full_name: c.full_name });
    setAssigning(null);
    if (result === "saved" || result === "prompt") onClose();
  };

  const candidates = load.status === "ready" ? load.data.candidates : [];

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-label="Suggest carers"
        className={cn(
          "flex max-h-[90dvh] w-full flex-col rounded-t-2xl border bg-popover text-sm shadow-2xl sm:rounded-2xl",
          compare ? "max-w-3xl" : "max-w-md",
        )}
      >
        <header className="flex items-start gap-2 border-b p-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">Suggest carers</h2>
            <p className="truncate text-xs text-muted-foreground">
              {visit.client_name} · {formatLondonShortDate(visit.start_time)} {timeRange(visit)}
              {replaced ? ` · replaces ${replaced.full_name}` : ""}
            </p>
          </div>
          {candidates.length > 1 && (
            <button
              type="button"
              aria-pressed={compare}
              onClick={() => setCompare((c) => !c)}
              className={cn("rounded-lg border px-2.5 py-1 text-xs hover:bg-accent", compare && "bg-accent")}
            >
              Compare
            </button>
          )}
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 hover:bg-accent">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
          {load.status === "loading" && (
            <div aria-busy="true" aria-label="Finding the best carers" className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          )}
          {load.status === "error" && (
            <div role="alert" className="space-y-2">
              <p>Could not load suggestions: {load.message}</p>
              <button type="button" onClick={() => setAttempt((n) => n + 1)} className="rounded-lg border px-3 py-1.5 hover:bg-accent">
                Try again
              </button>
            </div>
          )}
          {load.status === "ready" && candidates.length === 0 && (
            <p className="text-muted-foreground">No carer is available for this visit{load.data.excluded.length ? ", see why below" : ""}.</p>
          )}
          {load.status === "ready" && candidates.length > 0 && compare && (
            <CompareView candidates={candidates} assigning={assigning} assignLabel={assignLabel} onAssign={(c) => void assign(c)} />
          )}
          {load.status === "ready" &&
            !compare &&
            candidates.map((c, i) => (
              <article key={c.carer_id} className="space-y-2 rounded-xl border p-3" aria-label={`${i + 1}. ${c.full_name}, ${pct(c.total)} match`}>
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">{i + 1}</span>
                  <h3 className="min-w-0 flex-1 truncate font-semibold">{c.full_name}</h3>
                  <span className="rounded px-1.5 py-0.5 text-sm font-bold tabular-nums" style={{ backgroundColor: heatColor(c.total, 0.4) }}>
                    {pct(c.total)}
                  </span>
                </div>
                <div role="presentation" className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${c.total}%`, backgroundColor: heatColor(c.total, 0.9) }} />
                </div>
                {c.reasons.length > 0 && (
                  <ul className="list-disc space-y-0.5 pl-4 text-xs">
                    {c.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                )}
                {c.warnings.length > 0 && (
                  <ul className="space-y-0.5 text-xs text-amber-800 dark:text-amber-300">
                    {c.warnings.map((w) => (
                      <li key={w} className="flex gap-1">
                        <AlertTriangle aria-hidden className="mt-0.5 h-3 w-3 shrink-0" />
                        {w}
                      </li>
                    ))}
                  </ul>
                )}
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">Score breakdown</summary>
                  <ul className="mt-1 space-y-1">
                    {WEIGHT_KEYS.filter((k) => c.breakdown[k].applicable).map((k) => {
                      const f = c.breakdown[k];
                      return (
                        <li key={k} className="grid grid-cols-[8.5rem_1fr_3.5rem] items-center gap-2">
                          <span className="truncate">{FACTOR_LABELS[k]}</span>
                          <span role="presentation" className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <span className="block h-full rounded-full" style={{ width: `${(f.value ?? 0) * 100}%`, backgroundColor: heatColor((f.value ?? 0) * 100, 0.9) }} />
                          </span>
                          <span className="text-right tabular-nums text-muted-foreground">
                            {f.points.toFixed(1)}/{f.weight}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </details>
                <button
                  type="button"
                  disabled={assigning !== null}
                  onClick={() => void assign(c)}
                  className="w-full rounded-lg bg-primary px-3 py-1.5 text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {assigning === c.carer_id ? "Assigning…" : assignLabel(c)}
                </button>
              </article>
            ))}

          {load.status === "ready" && load.data.excluded.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">Not available ({load.data.excluded.length})</summary>
              <ul className="mt-1 space-y-0.5">
                {load.data.excluded.map((e) => (
                  <li key={e.carer_id} title={e.message} className="flex justify-between gap-2 text-muted-foreground">
                    <span className="truncate">{e.full_name}</span>
                    <span className="shrink-0">{e.short}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </section>
    </div>
  );
}
