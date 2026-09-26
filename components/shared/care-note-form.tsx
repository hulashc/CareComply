"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, X } from "lucide-react";
import { VoiceInput } from "@/components/shared/voice-input";

type CareNoteFormProps = {
  clientId: string;
  carers: { id: string; full_name: string }[];
};

export function CareNoteForm({ clientId, carers }: CareNoteFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteType, setNoteType] = useState("observation");
  const [carerId, setCarerId] = useState("");
  const [mood, setMood] = useState("");
  const [fluids, setFluids] = useState("");
  const [nutrition, setNutrition] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!noteText.trim()) return;
    setSubmitting(true);
    setError("");

    const res = await fetch("/api/care-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        carer_id: carerId || null,
        note_type: noteType,
        note_text: noteText,
        mood: mood || null,
        fluids: fluids || null,
        nutrition: nutrition || null,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to save note");
      setSubmitting(false);
      return;
    }

    setNoteText("");
    setNoteType("observation");
    setMood("");
    setFluids("");
    setNutrition("");
    setSubmitting(false);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <div className="mt-4">
        <Button variant="outline" className="rounded-xl gap-2" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Care Note
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border bg-muted/30 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm">New Care Note</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Type</label>
            <Select value={noteType} onValueChange={setNoteType}>
              <SelectTrigger className="rounded-xl mt-1">
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
          <div>
            <label className="text-xs font-medium text-muted-foreground">Carer</label>
            <Select value={carerId} onValueChange={setCarerId}>
              <SelectTrigger className="rounded-xl mt-1">
                <SelectValue placeholder="Select carer (optional)" />
              </SelectTrigger>
              <SelectContent>
                {carers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="relative">
          <Textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Describe the observation or event... or click the mic to dictate"
            className="rounded-xl min-h-[80px] pr-12"
            required
          />
          <div className="absolute right-2 top-2">
            <VoiceInput
              onResult={(text, suggestions) => {
                setNoteText(text);
                if (suggestions.mood) setMood(suggestions.mood);
                if (suggestions.fluids) setFluids(suggestions.fluids);
                if (suggestions.nutrition) setNutrition(suggestions.nutrition);
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Mood</label>
            <Select value={mood} onValueChange={setMood}>
              <SelectTrigger className="rounded-xl mt-1 text-sm">
                <SelectValue placeholder="-" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="happy">😊 Happy</SelectItem>
                <SelectItem value="neutral">😐 Neutral</SelectItem>
                <SelectItem value="concerned">😟 Concerned</SelectItem>
                <SelectItem value="distressed">😢 Distressed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Fluids</label>
            <Select value={fluids} onValueChange={setFluids}>
              <SelectTrigger className="rounded-xl mt-1 text-sm">
                <SelectValue placeholder="-" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="refused">Refused</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Nutrition</label>
            <Select value={nutrition} onValueChange={setNutrition}>
              <SelectTrigger className="rounded-xl mt-1 text-sm">
                <SelectValue placeholder="-" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Full meal</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="refused">Refused</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" className="rounded-xl" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={submitting} className="rounded-xl">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Note"}
          </Button>
        </div>
      </form>
    </div>
  );
}
