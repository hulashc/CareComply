"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, X } from "lucide-react";

export function CarePlanForm({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [goals, setGoals] = useState("");
  const [interventions, setInterventions] = useState("");
  const [notes, setNotes] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true); setError("");
    const res = await fetch("/api/care-plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_id: clientId, title, goals, interventions, notes, review_date: reviewDate || null }) });
    if (!res.ok) { setError((await res.json()).error); setSubmitting(false); return; }
    setTitle(""); setOpen(false); setSubmitting(false); router.refresh();
  }

  if (!open) return <Button variant="outline" className="rounded-xl gap-2 mt-4" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Add Care Plan</Button>;

  return (
    <div className="rounded-2xl border bg-muted/30 p-5">
      <div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-sm">New Care Plan</h3><Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button></div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Care plan title..." className="rounded-xl" required />
        <Textarea value={goals} onChange={(e) => setGoals(e.target.value)} placeholder="Goals and outcomes..." className="rounded-xl" rows={3} />
        <Textarea value={interventions} onChange={(e) => setInterventions(e.target.value)} placeholder="Interventions and support..." className="rounded-xl" rows={3} />
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes..." className="rounded-xl" rows={2} />
        <div><label className="text-xs font-medium text-muted-foreground">Review Date</label><Input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} className="rounded-xl mt-1" /></div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" size="sm" className="rounded-xl" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" size="sm" disabled={submitting} className="rounded-xl">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Plan"}</Button></div>
      </form>
    </div>
  );
}
