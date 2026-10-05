"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, MessageSquare, Clock, Loader2, Search } from "lucide-react";

type Handover = {
  id: string;
  client_id: string;
  from_carer_id: string | null;
  to_carer_id: string | null;
  note_text: string;
  mood: string | null;
  concerns: string | null;
  tasks_completed: string | null;
  tasks_remaining: string | null;
  is_read: boolean;
  created_at: string;
  clients: { full_name: string } | null;
};

type Client = { id: string; full_name: string };
type Carer = { id: string; full_name: string };

export function HandoverActions({
  initialHandovers,
  initialClients,
  initialCarers,
}: {
  initialHandovers: Handover[];
  initialClients: Client[];
  initialCarers: Carer[];
}) {
  const [handovers, setHandovers] = useState(initialHandovers);
  const [clients] = useState(initialClients);
  const [carers] = useState(initialCarers);
  const [showForm, setShowForm] = useState(false);
  const [clientId, setClientId] = useState("");
  const [fromCarerId, setFromCarerId] = useState("");
  const [toCarerId, setToCarerId] = useState("");
  const [noteText, setNoteText] = useState("");
  const [mood, setMood] = useState("");
  const [concerns, setConcerns] = useState("");
  const [tasksCompleted, setTasksCompleted] = useState("");
  const [tasksRemaining, setTasksRemaining] = useState("");
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    const supabase = createClient();
    const { data: h } = await supabase
      .from("handover_notes")
      .select("*, clients(full_name)")
      .order("created_at", { ascending: false });
    setHandovers(h ?? []);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId || !noteText.trim()) return;
    setSubmitting(true);
    const res = await fetch("/api/handovers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        from_carer_id: fromCarerId || null,
        to_carer_id: toCarerId || null,
        note_text: noteText,
        mood: mood || null,
        concerns: concerns || null,
        tasks_completed: tasksCompleted || null,
        tasks_remaining: tasksRemaining || null,
      }),
    });
    if (res.ok) {
      setShowForm(false);
      setNoteText("");
      setMood("");
      setConcerns("");
      setTasksCompleted("");
      setTasksRemaining("");
      loadData();
    }
    setSubmitting(false);
  }

  const filtered = handovers.filter(h =>
    !search || (h.clients?.full_name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search client..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 w-48 rounded-lg border border-border/50 bg-background pl-9 pr-3 text-xs outline-none focus:border-primary/50"
          />
        </div>
        <Button className="rounded-xl gap-2" onClick={() => setShowForm(!showForm)}>
          <MessageSquare className="h-4 w-4" />
          {showForm ? "Cancel" : "New Handover"}
        </Button>
      </div>

      {showForm && (
        <Card className="rounded-xl border border-border/50 shadow-card">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">New Handover Note</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Client *</label>
                  <Select value={clientId} onValueChange={setClientId}>
                    <SelectTrigger className="rounded-xl mt-1"><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">From Carer</label>
                  <Select value={fromCarerId} onValueChange={setFromCarerId}>
                    <SelectTrigger className="rounded-xl mt-1"><SelectValue placeholder="Outgoing carer" /></SelectTrigger>
                    <SelectContent>
                      {carers.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">To Carer</label>
                  <Select value={toCarerId} onValueChange={setToCarerId}>
                    <SelectTrigger className="rounded-xl mt-1"><SelectValue placeholder="Incoming carer" /></SelectTrigger>
                    <SelectContent>
                      {carers.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Handover details..." className="rounded-xl" rows={4} required />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Mood</label>
                  <Select value={mood} onValueChange={setMood}>
                    <SelectTrigger className="rounded-xl mt-1"><SelectValue placeholder="Client mood" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="happy">😊 Happy</SelectItem>
                      <SelectItem value="neutral">😐 Neutral</SelectItem>
                      <SelectItem value="concerned">😟 Concerned</SelectItem>
                      <SelectItem value="distressed">😢 Distressed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Concerns</label>
                  <Input value={concerns} onChange={e => setConcerns(e.target.value)} placeholder="Flag any concerns" className="rounded-xl mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Tasks Completed</label>
                  <Textarea value={tasksCompleted} onChange={e => setTasksCompleted(e.target.value)} placeholder="What was done" className="rounded-xl" rows={2} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Tasks Remaining</label>
                  <Textarea value={tasksRemaining} onChange={e => setTasksRemaining(e.target.value)} placeholder="What still needs doing" className="rounded-xl" rows={2} />
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={submitting} className="rounded-xl">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Handover"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {filtered.map((h) => (
          <Card key={h.id} className="rounded-xl border border-border/50 shadow-card">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="font-medium">{h.clients?.full_name ?? "Unknown"}</span>
                    <Badge variant="outline" className="rounded-md text-[10px]">
                      {h.is_read ? "Read" : "Unread"}
                    </Badge>
                    {h.mood && <Badge className="rounded-md text-[10px] bg-purple-100 text-purple-700">{h.mood}</Badge>}
                  </div>
                  <p className="text-sm">{h.note_text}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {h.concerns && (
                      <span className="flex items-center gap-1 text-amber-600">
                        <AlertCircle className="h-3 w-3" />
                        {h.concerns}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(h.created_at).toLocaleString()}
                    </span>
                  </div>
                  {h.tasks_remaining && (
                    <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      <span className="font-medium">Remaining: </span>{h.tasks_remaining}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <Card className="rounded-xl border border-border/50 shadow-card">
            <CardContent className="py-12 text-center">
              <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">{search ? "No handovers match your search." : "No handover notes yet."}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
