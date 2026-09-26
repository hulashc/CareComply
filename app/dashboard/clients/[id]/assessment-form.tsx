"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, X } from "lucide-react";

const SCORE_FIELDS = ["mobility", "nutrition", "hydration", "skin_integrity", "communication", "behaviour", "medication", "safeguarding"];

export function AssessmentForm({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("initial");
  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [nextReviewDate, setNextReviewDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function setScore(field: string, value: number) { setScores(p => ({ ...p, [field]: value })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true); setError("");
    const res = await fetch("/api/assessments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_id: clientId, title, category, scores, notes, next_review_date: nextReviewDate || null }) });
    if (!res.ok) { setError((await res.json()).error); setSubmitting(false); return; }
    setTitle(""); setScores({}); setOpen(false); setSubmitting(false); router.refresh();
  }

  if (!open) return <Button variant="outline" className="rounded-xl gap-2 mt-4" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />New Assessment</Button>;

  return (
    <div className="rounded-2xl border bg-muted/30 p-5">
      <div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-sm">New Assessment</h3><Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button></div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Assessment title..." className="rounded-xl" required />
          <Select value={category} onValueChange={setCategory}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="initial">Initial</SelectItem><SelectItem value="review">Review</SelectItem><SelectItem value="risk">Risk Assessment</SelectItem><SelectItem value="care">Care Needs</SelectItem></SelectContent></Select>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SCORE_FIELDS.map(f => (
            <div key={f} className="flex flex-col items-center rounded-xl bg-background p-2 border">
              <label className="text-[10px] font-medium text-muted-foreground capitalize mb-1">{f.replace("_", " ")}</label>
              <select value={scores[f] ?? ""} onChange={(e) => setScore(f, parseInt(e.target.value) || 0)} className="w-full rounded-lg border bg-muted/50 px-2 py-1 text-xs text-center">
                <option value="">-</option>
                {[1,2,3,4,5].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          ))}
        </div>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Assessment notes..." className="rounded-xl" rows={2} />
        <div><label className="text-xs font-medium text-muted-foreground">Next Review Date</label><Input type="date" value={nextReviewDate} onChange={(e) => setNextReviewDate(e.target.value)} className="rounded-xl mt-1" /></div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" size="sm" className="rounded-xl" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" size="sm" disabled={submitting} className="rounded-xl">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Assessment"}</Button></div>
      </form>
    </div>
  );
}
