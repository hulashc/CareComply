import { cn } from "@/lib/utils";
import type { Urgency, UrgencyLevel } from "@/lib/dashboard/shift-logic";

const LEVEL_STYLES: Record<UrgencyLevel, string> = {
  red: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
};

const LEVEL_DOT: Record<UrgencyLevel, string> = {
  red: "bg-red-500",
  amber: "bg-amber-500",
  green: "bg-emerald-500",
};

/** Colour is never the only signal: the label always carries the meaning. */
export function UrgencyBadge({ urgency, className }: { urgency: Urgency; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold",
        LEVEL_STYLES[urgency.level],
        className,
      )}
    >
      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", LEVEL_DOT[urgency.level])} />
      {urgency.label}
    </span>
  );
}
