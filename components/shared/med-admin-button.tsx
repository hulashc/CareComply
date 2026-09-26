"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";

export function MedAdminButton({ medicationId, carerId }: { medicationId: string; carerId?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function logAdministration(status: string) {
    setLoading(true);
    await fetch("/api/medication-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ medication_id: medicationId, carer_id: carerId || null, status }),
    });
    setLoading(false);
    if (status === "given") { setDone(true); setTimeout(() => setDone(false), 2000); }
    router.refresh();
  }

  if (done) return <span className="text-xs text-green-600 font-medium flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Given</span>;

  return (
    <div className="flex gap-1">
      <Button size="sm" variant="ghost" className="h-6 rounded-lg text-[10px] text-green-600 hover:bg-green-50 px-2" onClick={() => logAdministration("given")} disabled={loading}>
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Given"}
      </Button>
      <Button size="sm" variant="ghost" className="h-6 rounded-lg text-[10px] text-red-500 hover:bg-red-50 px-2" onClick={() => logAdministration("refused")} disabled={loading}>
        Refused
      </Button>
    </div>
  );
}
