"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, CheckCircle2, Pill, Sparkles } from "lucide-react";
import { useToast } from "@/components/shared/toast";
import Link from "next/link";
import { VoiceInput } from "@/components/shared/voice-input";
import { carerApi, type CarerRecord, type CarerClientSummary } from "@/lib/carer-api";

export default function CarerNotesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [carer, setCarer] = useState<CarerRecord | null>(null);
  const [clients, setClients] = useState<CarerClientSummary[]>([]);
  const [clientId, setClientId] = useState("");
  const [noteText, setNoteText] = useState("");
  const [noteType, setNoteType] = useState("observation");
  const [mood, setMood] = useState("");
  const [fluids, setFluids] = useState("");
  const [nutrition, setNutrition] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [c, shiftClients] = await Promise.all([carerApi.me(), carerApi.clients()]);
        setCarer(c);
        setClients(shiftClients);
      } catch { router.push("/auth/login"); return; }
    }
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId || !noteText.trim()) return;
    setSubmitting(true);
    const res = await fetch("/api/care-notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_id: clientId, carer_id: carer?.id, note_type: noteType, note_text: noteText, mood: mood || null, fluids: fluids || null, nutrition: nutrition || null }) });
    if (res.ok) { setDone(true); toast("Care note saved"); setTimeout(() => router.push("/carer"), 1500); }
    setSubmitting(false);
  }

  if (done) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500 mb-4">
        <CheckCircle2 className="h-8 w-8 text-white" />
      </div>
      <h2 className="text-lg font-bold text-slate-900">Note Saved</h2>
      <p className="text-sm text-slate-500 mt-1">Redirecting...</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/carer" className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors">
          <ArrowLeft className="h-4 w-4 text-slate-600" />
        </Link>
        <div className="flex items-center gap-2">
          <Pill className="h-5 w-5 text-teal-500" />
          <h1 className="text-lg font-bold text-slate-900">MAR / Care Note</h1>
        </div>
      </div>

      <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
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

          <div>
            <label className="text-[11px] font-bold uppercase text-slate-400 tracking-wider mb-1 block">Type</label>
            <Select value={noteType} onValueChange={setNoteType}>
              <SelectTrigger className="rounded-lg border-slate-200 bg-white h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="observation">Observation</SelectItem>
                <SelectItem value="medication">Medication</SelectItem>
                <SelectItem value="meal">Meal</SelectItem>
                <SelectItem value="incident">Incident</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="relative">
            <label className="text-[11px] font-bold uppercase text-slate-400 tracking-wider mb-1 block">Notes *</label>
            <Textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Type or tap the mic..."
              className="rounded-lg border-slate-200 bg-white min-h-[100px] text-sm pr-10"
              required
            />
            <div className="absolute right-2 bottom-2">
              <VoiceInput onResult={(text, s) => { setNoteText(text); if (s.mood) setMood(s.mood); if (s.fluids) setFluids(s.fluids); if (s.nutrition) setNutrition(s.nutrition); }} />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase text-slate-400 tracking-wider mb-1 block">Wellbeing</label>
            <div className="grid grid-cols-3 gap-2">
              <Select value={mood} onValueChange={setMood}>
                <SelectTrigger className="rounded-lg border-slate-200 bg-white h-10 text-sm"><SelectValue placeholder="Mood" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="happy">😊 Happy</SelectItem>
                  <SelectItem value="neutral">😐 Neutral</SelectItem>
                  <SelectItem value="concerned">😟 Concerned</SelectItem>
                  <SelectItem value="distressed">😢 Distressed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={fluids} onValueChange={setFluids}>
                <SelectTrigger className="rounded-lg border-slate-200 bg-white h-10 text-sm"><SelectValue placeholder="Fluids" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="refused">Refused</SelectItem>
                </SelectContent>
              </Select>
              <Select value={nutrition} onValueChange={setNutrition}>
                <SelectTrigger className="rounded-lg border-slate-200 bg-white h-10 text-sm"><SelectValue placeholder="Food" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="refused">Refused</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button type="submit" disabled={submitting || !clientId} className="w-full h-10 rounded-lg bg-teal-500 hover:bg-teal-600 text-white font-bold text-sm active:scale-[0.98]">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Sparkles className="h-4 w-4" /> Save Note</>}
          </Button>
        </form>
      </div>
    </div>
  );
}
