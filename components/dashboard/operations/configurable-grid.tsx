"use client";

import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { Check, ChevronDown, Plus, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PillSummary, PillTone } from "./pill-summary";

export interface ConfigurableBlock {
  id: string;
  title: string;
  priority: "primary" | "secondary";
  /** Whether the block is on the dashboard until the user changes it. */
  defaultVisible: boolean;
  /** Pre-rendered icon (components can't be passed from server to client). */
  icon: ReactNode;
  /** Count + urgency for the closed pill. */
  summary: PillSummary;
  /** Server-rendered block (already wrapped in its error boundary). */
  content: ReactNode;
}

const storageKey = (userId: string) => `carecomply:dashboard-blocks:${userId}`;

function readStored(key: string): string[] | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : null;
  } catch {
    return null;
  }
}

function writeStored(key: string, ids: string[] | null) {
  try {
    if (ids === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // Storage unavailable: the choice still applies for this page view.
  }
}

const BADGE_STYLES: Record<PillTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  amber: "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200",
  red: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300",
  error: "bg-destructive/10 text-destructive",
};

const TONE_HINT: Record<PillTone, string> = {
  neutral: "",
  amber: ", due soon",
  red: ", needs attention",
  error: ", failed to load",
};

function Pill({
  block,
  open,
  panelId,
  onToggle,
}: {
  block: ConfigurableBlock;
  open: boolean;
  panelId: string;
  onToggle: () => void;
}) {
  const { count, tone } = block.summary;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={open ? panelId : undefined}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full border pl-3 pr-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        open
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : block.priority === "primary"
            ? "border-border bg-card font-medium text-foreground shadow-sm hover:border-primary/40 hover:bg-primary/5"
            : "border-border/60 bg-muted/50 text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-foreground",
      )}
    >
      {block.icon}
      <span className="whitespace-nowrap">{block.title}</span>
      <span
        className={cn(
          "inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
          BADGE_STYLES[tone],
        )}
      >
        {count ?? "!"}
        <span className="sr-only">
          {count === undefined ? " items" : count === 1 ? " item" : " items"}
          {TONE_HINT[tone]}
        </span>
      </span>
      <ChevronDown aria-hidden className={cn("h-3.5 w-3.5 shrink-0 transition-transform", open && "rotate-180")} />
    </button>
  );
}

/**
 * Compact pill row. Each pill shows an icon, name and count (coloured when something needs action) and
 * opens its block in place below the row; several can be open at once. The "Configure Dashboard" button
 * sits at the end of the row and opens a panel listing every block, so hidden ones can be added.
 * The choice is saved per user in localStorage (per device). `null` means "use the defaults", so changing
 * a block's `defaultVisible` later reaches users who never customised.
 */
export function ConfigurableGrid({ userId, blocks }: { userId: string; blocks: ConfigurableBlock[] }) {
  const key = storageKey(userId);
  const configPanelId = useId();
  const [configOpen, setConfigOpen] = useState(false);
  const [saved, setSaved] = useState<string[] | null>(null);
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSaved(readStored(key));
    setHydrated(true);
  }, [key]);

  const defaults = useMemo(() => blocks.filter((b) => b.defaultVisible).map((b) => b.id), [blocks]);
  const visibleIds = useMemo(() => {
    const known = new Set(blocks.map((b) => b.id));
    return new Set((saved ?? defaults).filter((id) => known.has(id)));
  }, [saved, defaults, blocks]);

  const toggleVisible = useCallback(
    (id: string) => {
      const current = blocks.map((b) => b.id).filter((bid) => visibleIds.has(bid));
      const next = current.includes(id) ? current.filter((bid) => bid !== id) : [...current, id];
      setSaved(next);
      writeStored(key, next);
    },
    [blocks, visibleIds, key],
  );

  const restoreDefaults = useCallback(() => {
    setSaved(null);
    writeStored(key, null);
  }, [key]);

  const toggleOpen = useCallback((id: string) => {
    setOpenIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const shown = blocks.filter((b) => visibleIds.has(b.id));
  const openBlocks = shown.filter((b) => openIds.includes(b.id));
  const hiddenCount = blocks.length - shown.length;

  return (
    <section aria-label="Operations" className="mb-6">
      <div
        role="group"
        aria-label="Dashboard blocks"
        className={cn("flex flex-wrap items-center gap-2 transition-opacity duration-200", hydrated ? "opacity-100" : "opacity-0")}
      >
        {shown.map((b) => (
          <Pill
            key={b.id}
            block={b}
            open={openIds.includes(b.id)}
            panelId={`ops-${b.id}-panel`}
            onToggle={() => toggleOpen(b.id)}
          />
        ))}

        <button
          type="button"
          onClick={() => setConfigOpen((o) => !o)}
          aria-expanded={configOpen}
          aria-controls={configPanelId}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-dashed border-primary/50 bg-primary/10 px-3.5 text-sm font-medium text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        >
          <Plus aria-hidden className={cn("h-4 w-4 transition-transform", configOpen && "rotate-45")} />
          Configure Dashboard
          {hiddenCount > 0 && (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold tabular-nums">
              +{hiddenCount} more
              <span className="sr-only"> blocks available to add</span>
            </span>
          )}
        </button>

        {openBlocks.length > 0 && (
          <button
            type="button"
            onClick={() => setOpenIds([])}
            className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X aria-hidden className="h-3.5 w-3.5" />
            Close all
          </button>
        )}
      </div>

      {configOpen && (
        <div id={configPanelId} className="mt-3 rounded-lg border border-border/60 bg-card p-3 shadow-sm">
          <ul className="flex flex-wrap gap-2">
            {blocks.map((b) => {
              const added = visibleIds.has(b.id);
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => toggleVisible(b.id)}
                    aria-pressed={added}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      added
                        ? "border-border bg-muted text-muted-foreground hover:bg-muted/70"
                        : "border-secondary/50 bg-secondary/15 font-medium text-foreground hover:bg-secondary/25",
                    )}
                  >
                    {added ? <Check aria-hidden className="h-3.5 w-3.5" /> : <Plus aria-hidden className="h-3.5 w-3.5" />}
                    {b.title}
                    <span className="sr-only">{added ? " (on dashboard, select to remove)" : " (select to add)"}</span>
                  </button>
                </li>
              );
            })}
            <li>
              <button
                type="button"
                onClick={restoreDefaults}
                className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-900 transition-colors hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200 dark:hover:bg-amber-950/80"
              >
                <RefreshCw aria-hidden className="h-3.5 w-3.5" />
                Restore to defaults
              </button>
            </li>
          </ul>
          <p className="mt-3 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            Select a block to add it to the dashboard. Blocks in grey have already been added; select one to remove it.
          </p>
        </div>
      )}

      {shown.length === 0 ? (
        <div className={cn("mt-3 rounded-lg border border-dashed border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground", !hydrated && "opacity-0")}>
          No blocks on your dashboard. Use <span className="font-medium">Configure Dashboard</span> to add some.
        </div>
      ) : (
        openBlocks.length > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {openBlocks.map((b) => (
              <div key={b.id} id={`ops-${b.id}-panel`} className="min-w-0 animate-fade-up">
                {b.content}
              </div>
            ))}
          </div>
        )
      )}
    </section>
  );
}
