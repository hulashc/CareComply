"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/shared/toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, X } from "lucide-react";

type IncidentFormProps = {
  clients: { id: string; full_name: string }[];
};

export default function IncidentForm({ clients }: IncidentFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("low");
  const [category, setCategory] = useState("other");
  const [actionTaken, setActionTaken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId || !title || !description) return;
    setSubmitting(true);
    setError("");

    const res = await fetch("/api/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        title,
        description,
        severity,
        category,
        action_taken: actionTaken || null,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to report incident");
      setSubmitting(false);
      return;
    }

    setClientId("");
    setTitle("");
    setDescription("");
    setActionTaken("");
    setSeverity("low");
    setCategory("other");
    setOpen(false);
    setSubmitting(false);
    router.refresh();
    toast("Incident reported");
  }

  if (!open) {
    return (
      <Button variant="outline" className="rounded-xl gap-2 border-red-200 text-destructive hover:bg-red-50" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Report Incident
      </Button>
    );
  }

  return (
    <Card className="rounded-xl border border-border/50 shadow-card border-l-4 border-l-destructive">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg font-semibold">Report Incident</CardTitle>
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
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Severity *</label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger className="rounded-xl mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Category *</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="rounded-xl mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fall">Fall</SelectItem>
                  <SelectItem value="medication_error">Medication Error</SelectItem>
                  <SelectItem value="safeguarding">Safeguarding</SelectItem>
                  <SelectItem value="behaviour">Behaviour</SelectItem>
                  <SelectItem value="missing_person">Missing Person</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Title *</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Brief summary of the incident" className="rounded-xl mt-1" required />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Description *</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detailed description of what happened..." className="rounded-xl mt-1" rows={3} required />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Action Taken</label>
            <Textarea value={actionTaken} onChange={(e) => setActionTaken(e.target.value)} placeholder="Immediate actions taken to address the incident..." className="rounded-xl mt-1" rows={2} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" className="rounded-xl" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting} className="rounded-xl">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Report Incident"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
