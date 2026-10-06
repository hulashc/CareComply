"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import type { Tables } from "@/lib/database.types";

type AbsenceRow = Tables<"absences">;

export function CarerAbsencesTab({ carerId }: { carerId: string }) {
  const [absences, setAbsences] = useState<AbsenceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase.from("absences").select("*").eq("carer_id", carerId).order("start_date", { ascending: false }).limit(30);
      setAbsences(data ?? []);
      setLoading(false);
    }
    load();
  }, [carerId]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const typeColors: Record<string, string> = { sick_leave: "bg-red-100 text-red-700", holiday: "bg-blue-100 text-blue-700", training: "bg-teal-100 text-teal-700", other: "bg-gray-100 text-gray-700" };
  const statusColors: Record<string, string> = { pending: "bg-amber-100 text-amber-700", approved: "bg-green-100 text-green-700", rejected: "bg-red-100 text-red-700" };

  return (
    <Card className="rounded-2xl shadow-card border-0">
      <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Absence History</CardTitle></CardHeader>
      <CardContent>
        {absences.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No absences recorded.</p>
        ) : (
          <div className="space-y-2">
            {absences.map(a => (
              <div key={a.id} className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3 text-sm">
                <div>
                  <Badge className={`rounded-md text-[10px] mr-2 ${typeColors[a.absence_type] || ""}`}>{a.absence_type.replace("_", " ")}</Badge>
                  <span className="text-muted-foreground">{new Date(a.start_date).toLocaleDateString()} — {new Date(a.end_date).toLocaleDateString()}</span>
                </div>
                <Badge className={`rounded-md text-[10px] ${statusColors[a.status] || ""}`}>{a.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
