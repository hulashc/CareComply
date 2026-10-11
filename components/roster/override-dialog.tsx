"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { OverridePrompt } from "./use-roster-editor";

/** Conflicts never block a manager, but overriding them needs a reason (recorded in the audit log). */
export function OverrideDialog({ prompt, onConfirm, onCancel }: { prompt: OverridePrompt; onConfirm: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const ok = reason.trim().length >= 3;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onKeyDown={(e) => e.key === "Escape" && onCancel()}>
      <form
        role="alertdialog"
        aria-labelledby="override-title"
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) onConfirm(reason.trim());
        }}
        className="w-full max-w-md space-y-3 rounded-2xl border bg-popover p-4 text-sm shadow-2xl"
      >
        <h2 id="override-title" className="flex items-center gap-2 text-base font-semibold">
          <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden /> This conflicts with the roster
        </h2>
        <p className="text-muted-foreground">{prompt.cmd.label}</p>
        <ul className="list-disc space-y-1 pl-5">
          {prompt.items.map((i, n) => (
            <li key={n}>{i.message}</li>
          ))}
        </ul>
        <label className="block">
          <span className="text-xs font-medium">Reason for overriding (required)</span>
          <textarea
            ref={ref}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={300}
            className="mt-1 w-full rounded-lg border bg-background p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg border px-3 py-1.5 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
            Cancel
          </button>
          <button type="submit" disabled={!ok} className="rounded-lg bg-primary px-3 py-1.5 text-primary-foreground disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring">
            Override and save
          </button>
        </div>
      </form>
    </div>
  );
}
