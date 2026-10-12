import Link from "next/link";
import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, ChevronRight, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type BlockPriority = "primary" | "secondary";

interface BlockCardProps {
  id: string;
  title: string;
  icon: LucideIcon;
  priority: BlockPriority;
  viewAllHref: string;
  /** Badge number; omit to hide the badge. */
  count?: number;
  /** Set when the data fetch failed. */
  error?: string;
  /** True when there is nothing to action. */
  empty?: boolean;
  emptyText?: string;
  children?: ReactNode;
}

export function BlockCard({
  id,
  title,
  icon: Icon,
  priority,
  viewAllHref,
  count,
  error,
  empty,
  emptyText = "Nothing to action",
  children,
}: BlockCardProps) {
  const primary = priority === "primary";
  const headingId = `ops-${id}-title`;

  return (
    <Card
      aria-labelledby={headingId}
      data-priority={priority}
      className={cn(
        "gap-0 overflow-hidden rounded-lg py-0",
        primary ? "border-border/60 shadow-sm" : "border-border/30 bg-muted/30 shadow-none",
      )}
    >
      <CardHeader
        className={cn("flex flex-row items-center justify-between gap-2 border-b border-border/30 px-4", primary ? "py-3" : "py-2.5")}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Icon aria-hidden className={cn("shrink-0", primary ? "h-4 w-4 text-primary" : "h-3.5 w-3.5 text-muted-foreground")} />
          <CardTitle id={headingId} role="heading" aria-level={2} className={cn("truncate", primary ? "text-sm" : "text-xs")}>
            {title}
          </CardTitle>
          {count !== undefined && !error && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                count > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
              )}
              aria-label={`${count} items`}
            >
              {count}
            </span>
          )}
        </div>
        <Link
          href={viewAllHref}
          className="inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          View all <ChevronRight aria-hidden className="h-3 w-3" />
          <span className="sr-only"> {title}</span>
        </Link>
      </CardHeader>

      <CardContent className="p-0">
        {error ? (
          <div role="alert" className="flex items-start gap-2 px-4 py-4 text-xs text-destructive">
            <AlertCircle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div>
              <p className="font-semibold">Couldn&apos;t load this block</p>
              <p className="mt-0.5 break-words text-muted-foreground">{error}</p>
            </div>
          </div>
        ) : empty ? (
          <div className="flex items-center gap-2 px-4 py-5 text-sm text-muted-foreground">
            <CheckCircle2 aria-hidden className="h-4 w-4 text-emerald-500" />
            {emptyText}
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

/** Standard list wrapper so every block's rows share dividers and spacing. */
export function BlockList({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-border/30">{children}</ul>;
}

export function BlockRow({ href, children }: { href?: string; children: ReactNode }) {
  const className = "flex items-center justify-between gap-3 px-4 py-2.5";
  if (href) {
    return (
      <li>
        <Link href={href} className={cn(className, "transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none")}>
          {children}
        </Link>
      </li>
    );
  }
  return <li className={className}>{children}</li>;
}
