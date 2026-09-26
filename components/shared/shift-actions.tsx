"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export function ShiftActions({ shiftId, status }: { shiftId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function updateStatus(newStatus: string) {
    setLoading(true);
    await fetch(`/api/shifts/${shiftId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setLoading(false);
    router.refresh();
  }

  if (loading) return <Loader2 className="h-4 w-4 animate-spin" />;

  if (status === "scheduled") {
    return (
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" className="h-7 rounded-lg text-xs text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => updateStatus("completed")}>
          Complete
        </Button>
        <Button size="sm" variant="ghost" className="h-7 rounded-lg text-xs text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => updateStatus("cancelled")}>
          Cancel
        </Button>
      </div>
    );
  }

  if (status === "in_progress") {
    return (
      <Button size="sm" variant="ghost" className="h-7 rounded-lg text-xs text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => updateStatus("completed")}>
        Complete
      </Button>
    );
  }

  return null;
}
