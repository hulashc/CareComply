"use client";

import type { ReactNode } from "react";
import { Eye, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDismissedCards } from "./dismissed-cards-provider";

interface DismissibleCardProps {
  /** Stable id used for persistence, e.g. "expired-documents". */
  cardId: string;
  /** Human title, used for the accessible label. */
  title: string;
  children: ReactNode;
}

/**
 * Wraps an existing dashboard card with a small close button. The card collapses with a
 * grid-rows transition (no abrupt layout jump) and becomes inert so it can't be tabbed into.
 * Until localStorage has been read the card is held invisible (space reserved), so a card the
 * user already hid never flashes at full size.
 */
export function DismissibleCard({ cardId, title, children }: DismissibleCardProps) {
  const { hydrated, isDismissed, dismiss } = useDismissedCards();
  const hidden = hydrated && isDismissed(cardId);

  return (
    <div
      inert={hidden}
      aria-hidden={hidden || undefined}
      className={cn(
        "grid transition-[grid-template-rows,opacity,margin] duration-200 ease-out motion-reduce:transition-none",
        hidden ? "grid-rows-[0fr] opacity-0 !mt-0" : "grid-rows-[1fr]",
        !hydrated && "opacity-0",
        hydrated && !hidden && "opacity-100",
      )}
    >
      <div className="min-h-0 overflow-hidden">
        <div className="relative">
          {children}
          <button
            type="button"
            onClick={() => dismiss(cardId)}
            aria-label={`Hide ${title} card`}
            title={`Hide ${title}`}
            className="absolute right-1.5 top-1.5 z-10 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X aria-hidden className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Small header button that restores every hidden card. Renders nothing when none are hidden. */
export function ShowHiddenCardsButton() {
  const { hiddenCount, restoreAll, restoreButtonRef } = useDismissedCards();
  if (hiddenCount === 0) return null;
  return (
    <button
      ref={restoreButtonRef}
      type="button"
      onClick={restoreAll}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Eye aria-hidden className="h-3.5 w-3.5" />
      Show hidden cards ({hiddenCount})
    </button>
  );
}
