import { DRAFT_CLASS, STATUS_ORDER, STATUS_STYLES } from "@/lib/roster-ui/status";
import { cn } from "@/lib/utils";

export function Legend({ className }: { className?: string }) {
  return (
    <ul aria-label="Legend" className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground", className)}>
      {STATUS_ORDER.map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <span aria-hidden className={cn("inline-block h-3 w-3 rounded-sm", STATUS_STYLES[s].dot)} />
          {STATUS_STYLES[s].label}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span aria-hidden className={cn("inline-block h-3 w-3 rounded-sm border-2 bg-transparent", DRAFT_CLASS)} />
        Draft (not published)
      </li>
      <li className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="inline-block h-3 w-3 rounded-sm border"
          style={{ backgroundImage: "repeating-linear-gradient(45deg, rgba(100,116,139,.55) 0 3px, transparent 3px 6px)" }}
        />
        Leave / unavailable
      </li>
    </ul>
  );
}
