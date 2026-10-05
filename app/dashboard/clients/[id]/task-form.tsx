"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, X } from "lucide-react";

export function TaskForm({ clientId }: { clientId: string; carers: { id: string; full_name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true); setError("");
    const res = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_id: clientId, title, description, category, priority, due_date: dueDate || null }) });
    if (!res.ok) { setError((await res.json()).error); setSubmitting(false); return; }
    setTitle(""); setDescription(""); setOpen(false); setSubmitting(false); router.refresh();
  }

  if (!open) return <Button variant="outline" className="rounded-xl gap-2 mt-4" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Add Task</Button>;

  return (
    <div className="rounded-2xl border bg-muted/30 p-5">
      <div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-sm">New Task</h3><Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button></div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title..." className="rounded-xl" required />
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" className="rounded-xl" rows={2} />
        <div className="grid grid-cols-3 gap-3">
          <div><label className="text-xs font-medium text-muted-foreground">Category</label><Select value={category} onValueChange={setCategory}><SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="general">General</SelectItem><SelectItem value="medication">Medication</SelectItem><SelectItem value="personal_care">Personal Care</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent></Select></div>
          <div><label className="text-xs font-medium text-muted-foreground">Priority</label><Select value={priority} onValueChange={setPriority}><SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent></Select></div>
          <div><label className="text-xs font-medium text-muted-foreground">Due Date</label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="rounded-xl mt-1" /></div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" size="sm" className="rounded-xl" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" size="sm" disabled={submitting} className="rounded-xl">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Task"}</Button></div>
      </form>
    </div>
  );
}
