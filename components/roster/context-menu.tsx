"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface MenuItem {
  label: string;
  onSelect: () => void;
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
  /** Draw a divider above this item. */
  divider?: boolean;
}

/** A right-click menu at a screen position. Esc, outside click, scroll or resize closes it. */
export function ContextMenu({ at, items, onClose }: { at: { x: number; y: number }; items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    const close = (e: Event) => {
      if (e.type === "pointerdown" && ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const btns = [...(ref.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
        const i = btns.indexOf(document.activeElement as HTMLButtonElement);
        btns[(i + (e.key === "ArrowDown" ? 1 : -1) + btns.length) % btns.length]?.focus();
      }
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("resize", close);
    window.addEventListener("wheel", close, { passive: true });
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("wheel", close);
      window.removeEventListener("keydown", key);
    };
  }, [onClose]);

  const left = Math.min(at.x, (typeof window === "undefined" ? 9999 : window.innerWidth) - 232);
  const top = Math.min(at.y, (typeof window === "undefined" ? 9999 : window.innerHeight) - items.length * 32 - 16);

  return (
    <div ref={ref} role="menu" aria-label="Visit actions" className="fixed z-[80] w-56 rounded-xl border bg-popover p-1 text-sm shadow-xl" style={{ left, top }}>
      {items.map((it) => (
        <div key={it.label}>
          {it.divider && <div className="my-1 border-t" />}
          <button
            type="button"
            role="menuitem"
            disabled={it.disabled}
            onClick={() => {
              onClose();
              it.onSelect();
            }}
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none disabled:opacity-40",
              it.danger && "text-red-600 dark:text-red-400",
            )}
          >
            {it.label}
            {it.hint && <kbd className="text-[10px] text-muted-foreground">{it.hint}</kbd>}
          </button>
        </div>
      ))}
    </div>
  );
}
