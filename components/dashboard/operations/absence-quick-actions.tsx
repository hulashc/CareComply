"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Decision = "approved" | "rejected";

/** Approve / reject a pending absence via the existing PATCH /api/absences/[id] route. */
export function AbsenceQuickActions({ absenceId, carerName }: { absenceId: string; carerName: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<Decision | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(status: Decision) {
    setPending(status);
    setError(null);
    try {
      const res = await fetch(`/api/absences/${absenceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const body: { error?: string } = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Request failed");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      setPending(null);
    }
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <div className="flex gap-1.5">
        <Button
          size="sm"
          variant="outline"
          disabled={pending !== null}
          onClick={() => decide("approved")}
          aria-label={`Approve time off for ${carerName}`}
          className="h-7 gap-1 rounded-lg border-emerald-300 px-2 text-xs text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
        >
          <Check aria-hidden className="h-3 w-3" />
          {pending === "approved" ? "Approving…" : "Approve"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending !== null}
          onClick={() => decide("rejected")}
          aria-label={`Reject time off for ${carerName}`}
          className="h-7 gap-1 rounded-lg border-red-300 px-2 text-xs text-destructive hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
        >
          <X aria-hidden className="h-3 w-3" />
          {pending === "rejected" ? "Rejecting…" : "Reject"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-[11px] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
