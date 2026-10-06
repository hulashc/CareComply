"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, LogOut } from "lucide-react";

type Action = "check_in" | "check_out";

/** Records the actual start / end of a visit via PATCH /api/carer/shifts/[id]. */
export function CheckInOutButton({ shiftId, action }: { shiftId: string; action: Action }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/carer/shifts/${shiftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const body: { error?: string } = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Something went wrong");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const isIn = action === "check_in";
  const Icon = isIn ? LogIn : LogOut;

  return (
    <div>
      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className={
          isIn
            ? "flex w-full items-center justify-center gap-1.5 rounded-lg bg-teal-500 py-2 text-xs font-bold text-white transition-colors hover:bg-teal-600 disabled:opacity-60"
            : "flex w-full items-center justify-center gap-1.5 rounded-lg bg-teal-600 py-2 text-xs font-bold text-white transition-colors hover:bg-teal-700 disabled:opacity-60"
        }
      >
        <Icon aria-hidden className="h-3.5 w-3.5" />
        {busy ? (isIn ? "Checking in…" : "Checking out…") : isIn ? "Check in" : "Check out"}
      </button>
      {error && (
        <p role="alert" className="mt-1 text-center text-[11px] text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
