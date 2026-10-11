"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Option {
  value: string;
  label: string;
}

interface Props {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (next: string[]) => void;
}

/** A dependency-free, keyboard-accessible multi-select (button + checkbox list, Esc closes). */
export function MultiSelect({ label, options, selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return (f ? options.filter((o) => o.label.toLowerCase().includes(f)) : options).slice(0, 200);
  }, [options, filter]);

  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);

  return (
    <div
      ref={root}
      className="relative"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-8 items-center gap-1.5 rounded-lg border bg-background px-2.5 text-xs font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          selected.length > 0 && "border-primary text-primary",
        )}
      >
        {label}
        {selected.length > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{selected.length}</span>}
        <ChevronDown aria-hidden className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div id={id} role="group" aria-label={`${label} filter`} className="absolute left-0 top-9 z-50 w-64 rounded-xl border bg-popover p-2 shadow-lg">
          {options.length > 8 && (
            <input
              autoFocus
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={`Find ${label.toLowerCase()}…`}
              aria-label={`Find ${label.toLowerCase()}`}
              className="mb-2 h-8 w-full rounded-md border bg-background px-2 text-xs"
            />
          )}
          <ul className="max-h-60 overflow-auto">
            {shown.length === 0 && <li className="px-2 py-1.5 text-xs text-muted-foreground">Nothing to choose</li>}
            {shown.map((o) => (
              <li key={o.value}>
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent">
                  <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} className="h-3.5 w-3.5" />
                  <span className="truncate">{o.label}</span>
                </label>
              </li>
            ))}
          </ul>
          {selected.length > 0 && (
            <button type="button" onClick={() => onChange([])} className="mt-2 w-full rounded-md px-2 py-1 text-left text-xs text-muted-foreground hover:bg-accent">
              Clear {label.toLowerCase()}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
