"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, MessageSquare, Plus, Search, Send, Filter, Bell } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { useToast } from "@/components/shared/toast";
import Link from "next/link";
import { carerApi } from "@/lib/carer-api";

export default function CarerHandoversPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [carer, setCarer] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [handovers, setHandovers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [clientId, setClientId] = useState("");
  const [noteText, setNoteText] = useState("");
  const [mood, setMood] = useState("");
  const [concerns, setConcerns] = useState("");
  const [tasksRemaining, setTasksRemaining] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [readFilter, setReadFilter] = useState("all");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [c, h, shiftClients] = await Promise.all([carerApi.me(), carerApi.handovers(), carerApi.clients()]);
      setCarer(c);
      setHandovers(h);
      setClients(shiftClients);
    } catch { router.push("/auth/login"); return; }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId || !noteText.trim()) return;
    setSubmitting(true);
    await fetch("/api/handovers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, from_carer_id: carer.id, note_text: noteText, mood: mood || null, concerns: concerns || null, tasks_remaining: tasksRemaining || null }),
    });
    setShowForm(false);
    setNoteText("");
    loadData();
    toast("Handover submitted");
    setSubmitting(false);
  }

  const filtered = handovers.filter(h => {
    const matchesSearch = (h.clients?.full_name ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesRead = readFilter === "all" || (readFilter === "unread" && !h.is_read) || (readFilter === "read" && h.is_read);
    return matchesSearch && matchesRead;
  });

  const unreadCount = handovers.filter(h => !h.is_read).length;

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/carer" className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors">
            <ArrowLeft className="h-4 w-4 text-slate-600" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Handovers</h1>
            {unreadCount > 0 && <p className="text-xs font-semibold text-amber-600">{unreadCount} unread</p>}
          </div>
        </div>
        <Button size="sm" className="rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-semibold text-xs h-8 gap-1" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : <><Plus className="h-3.5 w-3.5" /> New</>}
        </Button>
      </div>

      {showForm && (
        <div className="rounded-xl bg-white border border-slate-200 border-l-4 border-l-indigo-400 p-4 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-3">
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="rounded-lg border-slate-200 bg-white h-10">
                <SelectValue placeholder="Select client *" />
              </SelectTrigger>
              <SelectContent>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Handover details..." className="rounded-lg border-slate-200 bg-white" rows={3} required />
            <div className="grid grid-cols-3 gap-2">
              <Select value={mood} onValueChange={setMood}>
                <SelectTrigger className="rounded-lg border-slate-200 bg-white h-9 text-sm"><SelectValue placeholder="Mood" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="happy">😊 Happy</SelectItem>
                  <SelectItem value="neutral">😐 Neutral</SelectItem>
                  <SelectItem value="concerned">😟 Concerned</SelectItem>
                  <SelectItem value="distressed">😢 Distressed</SelectItem>
                </SelectContent>
              </Select>
              <div className="col-span-2">
                <Input value={concerns} onChange={e => setConcerns(e.target.value)} placeholder="Concerns" className="rounded-lg border-slate-200 bg-white h-9" />
              </div>
            </div>
            <Input value={tasksRemaining} onChange={e => setTasksRemaining(e.target.value)} placeholder="Tasks remaining" className="rounded-lg border-slate-200 bg-white h-9" />
            <Button type="submit" disabled={submitting || !clientId} className="w-full h-9 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-sm active:scale-[0.98]">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4" /> Submit</>}
            </Button>
          </form>
        </div>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search by client..." value={search} onChange={e => setSearch(e.target.value)} className="rounded-lg border-slate-200 bg-white pl-9 h-9 text-sm" />
        </div>
        <select value={readFilter} onChange={e => setReadFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium h-9 cursor-pointer">
          <option value="all">All</option>
          <option value="unread">Unread</option>
          <option value="read">Read</option>
        </select>
      </div>

      <div className="space-y-2">
        {filtered.map((h) => (
          <div key={h.id} className="rounded-xl bg-white border border-slate-200 p-3.5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-bold text-slate-800">{h.clients?.full_name ?? "Unknown"}</span>
                  {!h.is_read && (
                    <Badge className="rounded-full bg-amber-50 text-amber-600 border-0 text-[10px] font-semibold flex items-center gap-1">
                      <Bell className="h-3 w-3" /> New
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{h.note_text}</p>
                {h.tasks_remaining && <p className="text-xs text-amber-600 mt-1.5 font-medium">{h.tasks_remaining}</p>}
                <p className="text-[11px] text-slate-400 mt-1">{new Date(h.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="rounded-xl bg-white border border-slate-200 p-6 text-center">
            <EmptyState icon={MessageSquare} title={search ? "No matches" : "No handovers"} description={search ? "Try a different search." : "Handovers for you will appear here."} />
          </div>
        )}
      </div>
    </div>
  );
}
