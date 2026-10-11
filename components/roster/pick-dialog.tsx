"use client";

import { useEffect, useRef, useState } from "react";

export interface PickOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface Props {
  title: string;
  confirmLabel: string;
  options: PickOption[];
  /** "one" = a single choice (select); "many" = checkboxes. */
  mode: "one" | "many";
  onConfirm: (values: string[]) => void;
  onCancel: () => void;
}

/** A small modal to choose one carer, or several days. */
export function PickDialog({ title, confirmLabel, options, mode, onConfirm, onCancel }: Props) {
  const [picked, setPicked] = useState<string[]>([]);
  const ref = useRef<HTMLSelectElement>(null);
  useEffect(() => ref.current?.focus(), []);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onKeyDown={(e) => e.key === "Escape" && onCancel()}>
      <form
        role="dialog"
        aria-label={title}
        onSubmit={(e) => {
          e.preventDefault();
          if (picked.length > 0) onConfirm(picked);
        }}
        className="w-full max-w-sm space-y-3 rounded-2xl border bg-popover p-4 text-sm shadow-2xl"
      >
        <h2 className="text-base font-semibold">{title}</h2>
        {mode === "one" ? (
          <select ref={ref} value={picked[0] ?? ""} onChange={(e) => setPicked(e.target.value ? [e.target.value] : [])} className="w-full rounded-lg border bg-background px-2 py-1.5">
            <option value="">Choose…</option>
            {options.map((o) => (
              <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
            ))}
          </select>
        ) : (
          <div className="grid max-h-64 grid-cols-2 gap-1 overflow-auto">
            {options.map((o) => (
              <label key={o.value} className="flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-accent">
                <input
                  type="checkbox"
                  disabled={o.disabled}
                  checked={picked.includes(o.value)}
                  onChange={() => setPicked((p) => (p.includes(o.value) ? p.filter((x) => x !== o.value) : [...p, o.value]))}
                />
                {o.label}
              </label>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg border px-3 py-1.5 hover:bg-accent">Cancel</button>
          <button type="submit" disabled={picked.length === 0} className="rounded-lg bg-primary px-3 py-1.5 text-primary-foreground disabled:opacity-50">{confirmLabel}</button>
        </div>
      </form>
    </div>
  );
}
