"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, X } from "lucide-react";

export function MedicationForm({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [drugName, setDrugName] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("");
  const [route, setRoute] = useState("oral");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [prescribedBy, setPrescribedBy] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!drugName.trim() || !dosage.trim() || !frequency.trim()) return;
    setSubmitting(true); setError("");
    const res = await fetch("/api/medications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_id: clientId, drug_name: drugName, dosage, frequency, route, start_date: startDate, end_date: endDate || null, prescribed_by: prescribedBy || null }) });
    if (!res.ok) { setError((await res.json()).error); setSubmitting(false); return; }
    setDrugName(""); setDosage(""); setFrequency(""); setOpen(false); setSubmitting(false); router.refresh();
  }

  if (!open) return <Button variant="outline" className="rounded-xl gap-2 mt-4" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Add Medication</Button>;

  return (
    <div className="rounded-2xl border bg-muted/30 p-5">
      <div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-sm">New Medication</h3><Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button></div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className="text-xs font-medium text-muted-foreground">Drug Name *</label><Input value={drugName} onChange={(e) => setDrugName(e.target.value)} placeholder="Paracetamol" className="rounded-xl mt-1" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">Dosage *</label><Input value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="500mg" className="rounded-xl mt-1" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">Frequency *</label><Input value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="Twice daily" className="rounded-xl mt-1" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">Route</label><Select value={route} onValueChange={setRoute}><SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="oral">Oral</SelectItem><SelectItem value="topical">Topical</SelectItem><SelectItem value="injection">Injection</SelectItem><SelectItem value="inhalation">Inhalation</SelectItem></SelectContent></Select></div>
          <div><label className="text-xs font-medium text-muted-foreground">Start Date</label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-xl mt-1" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">End Date</label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-xl mt-1" /></div>
        </div>
        <div><label className="text-xs font-medium text-muted-foreground">Prescribed By</label><Input value={prescribedBy} onChange={(e) => setPrescribedBy(e.target.value)} placeholder="Dr. Smith" className="rounded-xl mt-1" /></div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" size="sm" className="rounded-xl" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" size="sm" disabled={submitting} className="rounded-xl">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Medication"}</Button></div>
      </form>
    </div>
  );
}
