"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { addDays, isoWeekdayOf, londonDateOf, londonParts, londonWallClockToInstant, parseCalendarDate, toDateString } from "@/lib/dates/london";
import { cmd, newVisit, setCarers, type CarerRef } from "@/lib/roster-ui/commands";
import { carerConflicts } from "@/lib/roster-ui/conflicts";
import { invalidate } from "@/lib/roster-ui/api";
import type { RosterCarer, RosterClient } from "@/lib/roster-ui/types";
import { SAME_PERSON_MESSAGE, isSamePerson } from "@/lib/roster/same-person";
import type { VisitRow } from "@/lib/roster/types";
import type { RosterEditor } from "./use-roster-editor";

// Create / edit a visit. Quick mode (opened from a click or drag on the calendar) shows only what is
// needed; "More options" expands to the full form. Times are London wall-clock times.

export interface FormDraft {
  carerId: string | null;
  startMs: number;
  endMs: number;
}

interface Props {
  visit?: VisitRow;
  draft?: FormDraft;
  at?: { x: number; y: number } | null;
  clients: RosterClient[];
  carers: RosterCarer[];
  skills: { code: string; name: string }[];
  visits: VisitRow[];
  orgId: string;
  editor: RosterEditor;
  onClose: () => void;
  onReload: () => void;
}

const hhmm = (ms: number) => {
  const p = londonParts(new Date(ms));
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
};
const ymd = (ms: number) => londonDateOf(new Date(ms));
const toMs = (date: string, time: string) => {
  const [h, m] = time.split(":").map(Number);
  return londonWallClockToInstant(parseCalendarDate(date), h, m).getTime();
};

const field = "mt-1 w-full rounded-lg border bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function VisitForm(p: Props) {
  const editing = !!p.visit;
  const v = p.visit;
  const startMs0 = v ? Date.parse(v.start_time) : p.draft!.startMs;
  const endMs0 = v ? Date.parse(v.end_time) : p.draft!.endMs;

  const [full, setFull] = useState(editing || !p.at);
  const [clientId, setClientId] = useState(v?.client_id ?? "");
  const [date, setDate] = useState(ymd(startMs0));
  const [start, setStart] = useState(hhmm(startMs0));
  const [end, setEnd] = useState(hhmm(endMs0));
  const [needed, setNeeded] = useState<1 | 2>((v?.required_carers as 1 | 2) ?? 1);
  const [carer1, setCarer1] = useState(v?.carers[0]?.carer_id ?? p.draft?.carerId ?? "");
  const [carer2, setCarer2] = useState(v?.carers[1]?.carer_id ?? "");
  const [notes, setNotes] = useState(v?.notes ?? "");
  const [skills, setSkills] = useState<string[]>(v?.required_skills ?? []);
  const [scope, setScope] = useState<"this" | "following" | "all">("this");
  const [repeat, setRepeat] = useState<"none" | "daily" | "weekly">("none");
  const [until, setUntil] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const firstRef = useRef<HTMLSelectElement>(null);
  useEffect(() => firstRef.current?.focus(), []);

  const inSeries = !!v?.series_id;
  const seriesEdit = inSeries && scope !== "this";
  const startMs = toMs(date, start);
  let endMs = toMs(date, end);
  if (endMs <= startMs) endMs = toMs(toDateString(addDays(parseCalendarDate(date), 1)), end); // overnight

  // A client can never be their own carer: they are left out of the Carer lists, and a save is refused.
  const pickedClient = p.clients.find((c) => c.id === clientId);
  const clientParty = editing ? { id: v!.client_id, name: v!.client_name } : { id: pickedClient?.id, name: pickedClient?.full_name };
  const sameAsClient = (carerId: string) => {
    const c = p.carers.find((x) => x.carer_id === carerId);
    return !!c && isSamePerson(clientParty, { id: c.carer_id, name: c.full_name });
  };
  const eligibleCarers = p.carers.filter((c) => !isSamePerson(clientParty, { id: c.carer_id, name: c.full_name }));
  // If the client changes to someone already chosen as a carer, drop that carer and say why.
  useEffect(() => {
    const bad1 = !!carer1 && sameAsClient(carer1);
    const bad2 = !!carer2 && sameAsClient(carer2);
    if (bad1) setCarer1("");
    if (bad2) setCarer2("");
    if (bad1 || bad2) setErr(SAME_PERSON_MESSAGE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const carerRef = (id: string): CarerRef | null => {
    const c = p.carers.find((x) => x.carer_id === id);
    return c ? { carer_id: c.carer_id, full_name: c.full_name } : null;
  };
  const chosen = [carer1, needed === 2 ? carer2 : ""].filter(Boolean);

  // Live conflict hint for the chosen carers (information only; saving still works).
  const hints = chosen.flatMap((id) => {
    const c = p.carers.find((x) => x.carer_id === id);
    const probe = { id: v?.id ?? "new", start_time: new Date(startMs).toISOString(), end_time: new Date(endMs).toISOString(), status: "assigned" as const, required_carers: needed, carers: [] };
    const others = p.visits.filter((x) => x.id !== v?.id && x.carers.some((k) => k.carer_id === id));
    return carerConflicts(probe, c, others);
  });

  const toggleSkill = (code: string) => setSkills((s) => (s.includes(code) ? s.filter((x) => x !== code) : [...s, code]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!editing && !clientId) return setErr("Choose a client");
    if (!date || !start || !end) return setErr("Enter a date and times");
    if (needed === 2 && carer1 && carer2 && carer1 === carer2) return setErr("Choose two different carers");
    if (chosen.some(sameAsClient)) return setErr(SAME_PERSON_MESSAGE);
    const refs = chosen.map(carerRef).filter((x): x is CarerRef => !!x);

    if (editing && v) {
      const base: VisitRow = { ...v, notes: notes.trim() || null, required_skills: skills, required_carers: needed };
      let after = base;
      if (seriesEdit) {
        // Series edits change the time of day only; the date and carers are per-visit.
        after = { ...base, start_time: new Date(toMs(ymd(Date.parse(v.start_time)), start)).toISOString(), end_time: new Date(toMs(ymd(Date.parse(v.start_time)), end) + (endMs <= startMs ? 86_400_000 : 0)).toISOString() };
      } else {
        after = setCarers({ ...base, start_time: new Date(startMs).toISOString(), end_time: new Date(endMs).toISOString() }, refs);
      }
      setBusy(true);
      const r = await p.editor.act(cmd("Edit visit", [v], [after], seriesEdit ? scope : undefined));
      setBusy(false);
      if (r !== "refused") p.onClose();
      return;
    }

    const client = p.clients.find((c) => c.id === clientId);
    if (!client) return setErr("Choose a client");

    if (repeat !== "none") {
      setBusy(true);
      try {
        const res = await fetch("/api/roster/visits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: clientId,
            location_id: client.location_id,
            date,
            start_time: start,
            end_time: end,
            required_carers: needed,
            required_skills: skills,
            notes: notes.trim() || null,
            carer_ids: refs.map((r) => r.carer_id),
            force: refs.length > 0 && hints.length > 0,
            recurrence: { frequency: repeat === "daily" ? "daily" : "weekly", repeat_every: 1, by_weekday: repeat === "weekly" ? [isoWeekdayOf(parseCalendarDate(date))] : [], until_date: until || null },
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? "Could not create the series");
        invalidate();
        p.onReload();
        p.editor.notify(`Created ${body.count} recurring visits. Undo does not apply to a new series; delete it from the visit menu if needed.`);
        p.onClose();
      } catch (ex) {
        setErr(ex instanceof Error ? ex.message : "Could not create the series");
        setBusy(false);
      }
      return;
    }

    const created = newVisit(
      {
        org_id: p.orgId,
        client_id: clientId,
        client_name: client.full_name,
        location_id: client.location_id,
        start_time: new Date(startMs).toISOString(),
        end_time: new Date(endMs).toISOString(),
        required_carers: needed,
        required_skills: skills,
        notes: notes.trim() || null,
        roster_state: "draft",
      },
      refs,
    );
    setBusy(true);
    const r = await p.editor.act(cmd("Create visit", [], [created]));
    setBusy(false);
    if (r !== "refused") p.onClose();
  }

  const pos = !full && p.at ? { left: Math.min(p.at.x, window.innerWidth - 340), top: Math.min(p.at.y + 8, window.innerHeight - 330) } : null;

  return (
    <div className={pos ? "fixed inset-0 z-[60]" : "fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"} onKeyDown={(e) => e.key === "Escape" && p.onClose()}>
      {pos && <div className="absolute inset-0" onPointerDown={p.onClose} />}
      <form
        role="dialog"
        aria-label={editing ? "Edit visit" : "New visit"}
        onSubmit={submit}
        className={`space-y-3 rounded-2xl border bg-popover p-4 text-sm shadow-2xl ${pos ? "absolute w-80" : "max-h-[90vh] w-full max-w-lg overflow-auto"}`}
        style={pos ?? undefined}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{editing ? "Edit visit" : "New visit"}</h2>
          <button type="button" onClick={p.onClose} aria-label="Close" className="rounded-md p-1 hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="block text-xs font-medium">
          Client
          {editing ? (
            <p className="mt-1 text-sm font-normal">{v!.client_name}</p>
          ) : (
            <select ref={firstRef} value={clientId} onChange={(e) => setClientId(e.target.value)} className={field}>
              <option value="">Choose a client…</option>
              {p.clients.map((c) => (
                <option key={c.id} value={c.id}>{c.full_name}</option>
              ))}
            </select>
          )}
        </label>

        {inSeries && (
          <fieldset className="rounded-lg border p-2">
            <legend className="px-1 text-xs font-medium">This visit is part of a series. Apply changes to</legend>
            {(["this", "following", "all"] as const).map((s) => (
              <label key={s} className="mr-3 inline-flex items-center gap-1 text-sm">
                <input type="radio" name="scope" checked={scope === s} onChange={() => setScope(s)} />
                {s === "this" ? "This visit" : s === "following" ? "This and following" : "All visits"}
              </label>
            ))}
            {seriesEdit && <p className="mt-1 text-xs text-muted-foreground">Time of day, notes, skills and carers needed apply to the series. The date and carers stay per visit.</p>}
          </fieldset>
        )}

        <div className="grid grid-cols-3 gap-2">
          <label className="text-xs font-medium">
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={seriesEdit} className={field} />
          </label>
          <label className="text-xs font-medium">
            Start
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={field} />
          </label>
          <label className="text-xs font-medium">
            End
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={field} />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs font-medium">
            Carers needed
            <select value={needed} onChange={(e) => setNeeded(Number(e.target.value) as 1 | 2)} className={field}>
              <option value={1}>1 carer</option>
              <option value={2}>2 carers (double-up)</option>
            </select>
          </label>
          <label className="text-xs font-medium">
            {needed === 2 ? "Lead carer" : "Carer"}
            <select value={carer1} onChange={(e) => setCarer1(e.target.value)} disabled={seriesEdit} className={field}>
              <option value="">Unassigned</option>
              {eligibleCarers.map((c) => (
                <option key={c.carer_id} value={c.carer_id}>{c.full_name}</option>
              ))}
            </select>
          </label>
        </div>
        {needed === 2 && (
          <label className="block text-xs font-medium">
            Second carer
            <select value={carer2} onChange={(e) => setCarer2(e.target.value)} disabled={seriesEdit} className={field}>
              <option value="">Unassigned</option>
              {eligibleCarers.filter((c) => c.carer_id !== carer1).map((c) => (
                <option key={c.carer_id} value={c.carer_id}>{c.full_name}</option>
              ))}
            </select>
          </label>
        )}

        {hints.length > 0 && (
          <ul role="status" className="space-y-0.5 rounded-lg border border-amber-500/50 bg-amber-500/10 p-2 text-xs">
            {hints.map((h, i) => (
              <li key={i}>{h.blocking ? "Blocked: " : "Warning: "}{h.message}</li>
            ))}
          </ul>
        )}

        {!full ? (
          <button type="button" onClick={() => setFull(true)} className="text-xs text-primary underline">More options…</button>
        ) : (
          <>
            <label className="block text-xs font-medium">
              Notes
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000} className={field} />
            </label>
            {p.skills.length > 0 && (
              <fieldset>
                <legend className="text-xs font-medium">Skills required</legend>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  {p.skills.map((s) => (
                    <label key={s.code} className="inline-flex items-center gap-1 text-xs">
                      <input type="checkbox" checked={skills.includes(s.code)} onChange={() => toggleSkill(s.code)} /> {s.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {!editing && (
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-medium">
                  Repeat
                  <select value={repeat} onChange={(e) => setRepeat(e.target.value as typeof repeat)} className={field}>
                    <option value="none">Does not repeat</option>
                    <option value="daily">Every day</option>
                    <option value="weekly">Every week on this day</option>
                  </select>
                </label>
                {repeat !== "none" && (
                  <label className="text-xs font-medium">
                    Until (optional)
                    <input type="date" value={until} min={date} onChange={(e) => setUntil(e.target.value)} className={field} />
                  </label>
                )}
              </div>
            )}
          </>
        )}

        {err && <p role="alert" className="text-xs text-red-600">{err}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={p.onClose} className="rounded-lg border px-3 py-1.5 hover:bg-accent">Cancel</button>
          <button type="submit" disabled={busy} className="rounded-lg bg-primary px-3 py-1.5 text-primary-foreground disabled:opacity-50">
            {editing ? "Save" : repeat !== "none" ? "Create series" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}
