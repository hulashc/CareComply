"use client";

import { AlertTriangle } from "lucide-react";
import { FACTOR_LABELS, heatColor, pct, type SuggestionsResponse } from "@/lib/roster-ui/ghost";
import { WEIGHT_KEYS } from "@/lib/roster/weights";

// Side-by-side comparison of the top candidates: points per factor (best in each row in bold), the
// total, the reasons and the warnings, with an Assign button per carer.

type Candidate = SuggestionsResponse["candidates"][number];

interface Props {
  candidates: Candidate[];
  assigning: string | null;
  assignLabel: (c: Candidate) => string;
  onAssign: (c: Candidate) => void;
}

export function CompareView({ candidates, assigning, assignLabel, onAssign }: Props) {
  // A factor that applies to the client applies to every candidate, so one candidate decides the rows.
  const rows = WEIGHT_KEYS.filter((k) => candidates[0]?.breakdown[k]?.applicable);
  const best = (pick: (c: Candidate) => number) => Math.max(...candidates.map(pick));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse text-xs">
        <caption className="sr-only">Comparison of the top {candidates.length} suggested carers</caption>
        <thead>
          <tr>
            <th scope="col" className="w-36 p-1.5 text-left font-medium text-muted-foreground">Factor</th>
            {candidates.map((c, i) => (
              <th key={c.carer_id} scope="col" className="p-1.5 text-left align-top">
                <span className="block text-[10px] font-normal text-muted-foreground">#{i + 1}</span>
                <span className="block truncate text-sm font-semibold">{c.full_name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-t">
            <th scope="row" className="p-1.5 text-left font-semibold">Match</th>
            {candidates.map((c) => (
              <td key={c.carer_id} className="p-1.5">
                <span className="rounded px-1.5 py-0.5 text-sm font-bold tabular-nums" style={{ backgroundColor: heatColor(c.total, 0.4) }}>{pct(c.total)}</span>
              </td>
            ))}
          </tr>
          {rows.map((k) => {
            const top = best((c) => c.breakdown[k].points);
            return (
              <tr key={k} className="border-t">
                <th scope="row" className="p-1.5 text-left font-normal text-muted-foreground">
                  {FACTOR_LABELS[k]} <span className="text-[10px]">(weight {candidates[0].breakdown[k].weight})</span>
                </th>
                {candidates.map((c) => {
                  const f = c.breakdown[k];
                  return (
                    <td key={c.carer_id} className={f.points === top && top > 0 ? "p-1.5 font-bold" : "p-1.5"}>
                      <span className="rounded px-1 tabular-nums" style={{ backgroundColor: f.value === null ? undefined : heatColor(f.value * 100, 0.2) }}>
                        {f.points.toFixed(1)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            );
          })}
          <tr className="border-t align-top">
            <th scope="row" className="p-1.5 text-left font-normal text-muted-foreground">Why</th>
            {candidates.map((c) => (
              <td key={c.carer_id} className="p-1.5">
                {c.reasons.length ? <ul className="list-disc space-y-0.5 pl-4">{c.reasons.map((r) => <li key={r}>{r}</li>)}</ul> : <span className="text-muted-foreground">—</span>}
              </td>
            ))}
          </tr>
          <tr className="border-t align-top">
            <th scope="row" className="p-1.5 text-left font-normal text-muted-foreground">Watch out</th>
            {candidates.map((c) => (
              <td key={c.carer_id} className="p-1.5">
                {c.warnings.length ? (
                  <ul className="space-y-0.5 text-amber-800 dark:text-amber-300">
                    {c.warnings.map((w) => (
                      <li key={w} className="flex gap-1"><AlertTriangle aria-hidden className="mt-0.5 h-3 w-3 shrink-0" />{w}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-muted-foreground">None</span>
                )}
              </td>
            ))}
          </tr>
          <tr className="border-t">
            <td />
            {candidates.map((c) => (
              <td key={c.carer_id} className="p-1.5">
                <button
                  type="button"
                  disabled={assigning !== null}
                  onClick={() => onAssign(c)}
                  className="rounded-lg bg-primary px-3 py-1.5 text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {assigning === c.carer_id ? "Assigning…" : assignLabel(c)}
                </button>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
