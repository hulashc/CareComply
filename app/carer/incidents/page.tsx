"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, CheckCircle2, AlertTriangle, AlertCircle } from "lucide-react";
import { useToast } from "@/components/shared/toast";
import Link from "next/link";
import { carerApi, type CarerClientSummary } from "@/lib/carer-api";

export default function CarerIncidentsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [clients, setClients] = useState<CarerClientSummary[]>([]);
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("low");
  const [category, setCategory] = useState("other");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [, shiftClients] = await Promise.all([carerApi.me(), carerApi.clients()]);
        setClients(shiftClients);
      } catch { router.push("/auth/login"); return; }
    }
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId || !title || !description) return;
    setSubmitting(true);
    const res = await fetch("/api/incidents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_id: clientId, title, description, severity, category }) });
    if (res.ok) { setDone(true); toast("Incident reported"); setTimeout(() => router.push("/carer"), 1500); }
    setSubmitting(false);
  }

  if (done) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500 mb-4">
        <CheckCircle2 className="h-8 w-8 text-white" />
      </div>
      <h2 className="text-lg font-bold text-slate-900">Incident Reported</h2>
      <p className="text-sm text-slate-500 mt-1">Admin will review shortly.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/carer" className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors">
          <ArrowLeft className="h-4 w-4 text-slate-600" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Report Incident</h1>
          <p className="text-xs text-slate-500">Something that needs noting</p>
        </div>
      </div>

      <div className="rounded-xl bg-white border border-slate-200 border-l-4 border-l-rose-400 p-4 shadow-sm">
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-50 border border-rose-100 mb-4">
          <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
          <p className="text-xs text-rose-700 leading-relaxed">Report only factual information. If someone is in immediate danger, call 999 first.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[11px] font-bold uppercase text-slate-400 tracking-wider mb-1 block">Client *</label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="rounded-lg border-slate-200 bg-white h-10">
                <SelectValue placeholder="Select client..." />
              </SelectTrigger>
              <SelectContent>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Brief title *" className="rounded-lg border-slate-200 bg-white h-10" required />

          <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe what happened in detail..." className="rounded-lg border-slate-200 bg-white min-h-[100px]" rows={4} required />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold uppercase text-slate-400 tracking-wider mb-1 block">Severity</label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger className="rounded-lg border-slate-200 bg-white h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low"><span className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-blue-500" /> Low</span></SelectItem>
                  <SelectItem value="medium"><span className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-amber-500" /> Medium</span></SelectItem>
                  <SelectItem value="high"><span className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-orange-500" /> High</span></SelectItem>
                  <SelectItem value="critical"><span className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-red-500" /> Critical</span></SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase text-slate-400 tracking-wider mb-1 block">Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="rounded-lg border-slate-200 bg-white h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fall">Fall</SelectItem>
                  <SelectItem value="medication_error">Medication</SelectItem>
                  <SelectItem value="safeguarding">Safeguarding</SelectItem>
                  <SelectItem value="behaviour">Behaviour</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button type="submit" disabled={submitting || !clientId} className="w-full h-10 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold text-sm active:scale-[0.98]">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><AlertTriangle className="h-4 w-4" /> Report Incident</>}
          </Button>
        </form>
      </div>
    </div>
  );
}
