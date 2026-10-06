"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";

interface DismissedCardsContextValue {
  /** False until localStorage has been read on the client. */
  hydrated: boolean;
  isDismissed: (cardId: string) => boolean;
  dismiss: (cardId: string) => void;
  restoreAll: () => void;
  hiddenCount: number;
  /** The "Show hidden cards" button; focus moves here after a card is dismissed. */
  restoreButtonRef: RefObject<HTMLButtonElement | null>;
}

const DismissedCardsContext = createContext<DismissedCardsContextValue | null>(null);

const storageKey = (userId: string) => `carecomply:dismissed-cards:${userId}`;

function readStored(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeStored(key: string, ids: string[]) {
  try {
    if (ids.length === 0) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // Storage unavailable (private mode / blocked): dismissal still works for this page view.
  }
}

/**
 * Per-user, per-device record of which dashboard cards are hidden. Stored in localStorage keyed by
 * user id (no schema needed); the trade-off is it does not follow the user across devices.
 */
export function DismissedCardsProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const key = storageKey(userId);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const restoreButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setDismissed(readStored(key));
    setHydrated(true);
  }, [key]);

  const dismiss = useCallback(
    (cardId: string) => {
      setDismissed((prev) => {
        if (prev.includes(cardId)) return prev;
        const next = [...prev, cardId];
        writeStored(key, next);
        return next;
      });
      // The card's own button is about to become inert; hand focus to the restore link instead.
      window.setTimeout(() => restoreButtonRef.current?.focus(), 0);
    },
    [key],
  );

  const restoreAll = useCallback(() => {
    setDismissed([]);
    writeStored(key, []);
  }, [key]);

  const value = useMemo<DismissedCardsContextValue>(
    () => ({
      hydrated,
      isDismissed: (cardId) => dismissed.includes(cardId),
      dismiss,
      restoreAll,
      hiddenCount: dismissed.length,
      restoreButtonRef,
    }),
    [hydrated, dismissed, dismiss, restoreAll],
  );

  return <DismissedCardsContext.Provider value={value}>{children}</DismissedCardsContext.Provider>;
}

export function useDismissedCards(): DismissedCardsContextValue {
  const ctx = useContext(DismissedCardsContext);
  if (!ctx) throw new Error("useDismissedCards must be used within <DismissedCardsProvider>");
  return ctx;
}
