"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarX, Loader2, CheckCircle2, XCircle, Clock, Search } from "lucide-react";
import { StatusFilter } from "@/components/shared/status-filter";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

const ABSENCE_TYPES = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const typeColors: Record<string, string> = {
  sick_leave: "bg-red-100 text-red-700",
  holiday: "bg-blue-100 text-blue-700",
  training: "bg-purple-100 text-purple-700",
  other: "bg-gray-100 text-gray-700",
};

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export function AbsenceActions({
  initialAbsences,
  initialCarers,
  currentStatus,
}: {
  initialAbsences: any[];
  initialCarers: any[];
  currentStatus: string;
}) {
  const [absences, setAbsences] = useState(initialAbsences);
  const [carers] = useState(initialCarers);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [carerId, setCarerId] = useState("");
  const [absenceType, setAbsenceType] = useState("sick_leave");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [search, setSearch] = useState("");
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: "approve" | "reject" } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  async function loadData() {
    const supabase = createClient();
    const status = searchParams.get("status");
    let query = supabase
      .from("absences")
      .select("*, carers(full_name)")
      .order("created_at", { ascending: false });
    if (status && status !== "all") query = query.eq("status", status);
    const { data: a } = await query;
    setAbsences(a ?? []);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!carerId || !startDate || !endDate) return;
    setSubmitting(true);
    const res = await fetch("/api/absences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        carer_id: carerId,
        absence_type: absenceType,
        start_date: startDate,
        end_date: endDate,
        reason,
      }),
    });
    if (res.ok) {
      setShowForm(false);
      setCarerId("");
      setStartDate("");
      setEndDate("");
      setReason("");
      loadData();
    }
    setSubmitting(false);
  }

  async function handleApprove(id: string) {
    setLoading(true);
    await fetch(`/api/absences/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });
    loadData();
    setLoading(false);
  }

  async function handleReject(id: string) {
    setLoading(true);
    await fetch(`/api/absences/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rejected" }),
    });
    loadData();
    setLoading(false);
  }

  const searched = absences.filter(a =>
    !search || (a.carers?.full_name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <StatusFilter label="Type" options={ABSENCE_TYPES} current={currentStatus} />
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search carer..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 w-44 rounded-lg border border-border/50 bg-background pl-9 pr-3 text-xs outline-none focus:border-primary/50"
            />
          </div>
        </div>
        <Button className="rounded-xl gap-2" onClick={() => setShowForm(!showForm)}>
          <CalendarX className="h-4 w-4" />
          {showForm ? "Cancel" : "Record Absence"}
        </Button>
      </div>

      {showForm && (
        <Card className="rounded-xl border border-border/50 shadow-card">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Record Absence</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Carer *</label>
                  <Select value={carerId} onValueChange={setCarerId}>
                    <SelectTrigger className="rounded-xl mt-1">
                      <SelectValue placeholder="Select carer" />
                    </SelectTrigger>
                    <SelectContent>
                      {carers.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Type</label>
                  <Select value={absenceType} onValueChange={setAbsenceType}>
                    <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sick_leave">Sick Leave</SelectItem>
                      <SelectItem value="holiday">Holiday</SelectItem>
                      <SelectItem value="training">Training</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Start Date *</label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="rounded-xl mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">End Date *</label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="rounded-xl mt-1" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Reason</label>
                <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Optional reason" className="rounded-xl mt-1" />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={submitting} className="rounded-xl">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Record Absence"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {searched.map((a: any) => (
          <Card key={a.id} className="rounded-xl border border-border/50 shadow-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                    <CalendarX className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{a.carers?.full_name ?? "Unknown"}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge className={`rounded-md text-[10px] ${typeColors[a.absence_type] || ""}`}>
                        {a.absence_type.replace("_", " ")}
                      </Badge>
                      <Badge className={`rounded-md text-[10px] ${statusColors[a.status] || ""}`}>
                        {a.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        <Clock className="inline h-3 w-3 mr-1" />
                        {new Date(a.start_date).toLocaleDateString()} — {new Date(a.end_date).toLocaleDateString()}
                      </span>
                    </div>
                    {a.reason && <p className="text-xs text-muted-foreground mt-1">{a.reason}</p>}
                  </div>
                </div>
                {a.status === "pending" && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm" variant="ghost"
                      className="h-7 rounded-lg text-xs text-green-600 hover:bg-green-50"
                      onClick={() => setConfirmAction({ id: a.id, action: "approve" })}
                      disabled={loading}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Approve
                    </Button>
                    <Button
                      size="sm" variant="ghost"
                      className="h-7 rounded-lg text-xs text-red-500 hover:bg-red-50"
                      onClick={() => setConfirmAction({ id: a.id, action: "reject" })}
                      disabled={loading}
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1" />Reject
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {searched.length === 0 && (
          <Card className="rounded-xl border border-border/50 shadow-card">
            <CardContent className="py-12 text-center">
              <CalendarX className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">{search ? "No absences match your search." : "No absences recorded."}</p>
            </CardContent>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={confirmAction !== null}
        title={confirmAction?.action === "approve" ? "Approve Absence" : "Reject Absence"}
        description={confirmAction?.action === "approve" ? "Mark this absence as approved?" : "Reject this absence request?"}
        confirmLabel={confirmAction?.action === "approve" ? "Approve" : "Reject"}
        variant={confirmAction?.action === "reject" ? "destructive" : "default"}
        loading={loading}
        onConfirm={() => {
          if (!confirmAction) return;
          if (confirmAction.action === "approve") handleApprove(confirmAction.id);
          else handleReject(confirmAction.id);
          setConfirmAction(null);
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
