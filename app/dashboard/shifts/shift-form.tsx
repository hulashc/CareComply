"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/shared/toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, X, AlertTriangle } from "lucide-react";

type ShiftFormProps = {
  clients: { id: string; full_name: string }[];
  carers: { id: string; full_name: string }[];
};

export default function ShiftForm({ clients, carers }: ShiftFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [carerId, setCarerId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [notes, setNotes] = useState("");
  const [recurrence, setRecurrence] = useState("none");
  const [recurrenceEnd, setRecurrenceEnd] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [conflicts, setConflicts] = useState<any[]>([]);

  useEffect(() => {
    if (!carerId || !date || !startTime || !endTime) { setConflicts([]); return; }
    const supabase = createClient();
    const start = `${date}T${startTime}:00`;
    const end = `${date}T${endTime}:00`;
    supabase.from("shifts").select("*, clients(full_name)").eq("carer_id", carerId).neq("status", "cancelled").lte("start_time", end).gte("end_time", start).then(({ data }) => setConflicts(data ?? []));
  }, [carerId, date, startTime, endTime]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId || !date) return;
    setSubmitting(true);
    setError("");

    const res = await fetch("/api/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        carer_id: carerId || null,
        start_time: `${date}T${startTime}:00`,
        end_time: `${date}T${endTime}:00`,
        notes: notes || null,
        recurrence_type: recurrence,
        recurrence_end_date: recurrenceEnd || null,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to create shift");
      setSubmitting(false);
      return;
    }

    setClientId("");
    setCarerId("");
    setNotes("");
    setOpen(false);
    setSubmitting(false);
    router.refresh();
    toast("Shift scheduled successfully");
  }

  if (!open) {
    return (
      <Button variant="outline" className="rounded-xl gap-2" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Schedule Shift
      </Button>
    );
  }

  return (
    <Card className="rounded-xl border border-border/50 shadow-card">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg font-semibold">New Shift</CardTitle>
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Client *</label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="rounded-xl mt-1">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground text-center">No clients yet. Add a client first.</div>
                  ) : (
                    clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Carer</label>
              <Select value={carerId} onValueChange={setCarerId}>
                <SelectTrigger className="rounded-xl mt-1">
                  <SelectValue placeholder="Select carer" />
                </SelectTrigger>
                <SelectContent>
                  {carers.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground text-center">No carers registered. Add a carer first.</div>
                  ) : (
                    carers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Date *</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl mt-1" required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Start</label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="rounded-xl mt-1" required />
            </div>
            {conflicts.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {conflicts.length} overlapping shift{conflicts.length !== 1 ? "s" : ""}: {conflicts.map(c => `${c.clients?.full_name ?? "Unknown"} (${new Date(c.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`).join(", ")}
              </div>
            )}
            <div>
                <label className="text-xs font-medium text-muted-foreground">End</label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="rounded-xl mt-1" required />
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Shift notes or instructions..."
              className="rounded-xl mt-1"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Recurrence</label>
              <Select value={recurrence} onValueChange={setRecurrence}>
                <SelectTrigger className="rounded-xl mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {recurrence !== "none" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">End Date</label>
                <Input type="date" value={recurrenceEnd} onChange={(e) => setRecurrenceEnd(e.target.value)} className="rounded-xl mt-1" />
              </div>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" className="rounded-xl" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting} className="rounded-xl">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Schedule"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
