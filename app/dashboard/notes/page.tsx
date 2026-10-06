import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { FileText, Search, ArrowRight, Clock } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import type { Tables } from "@/lib/database.types";

type CareNoteRow = Tables<"care_notes"> & { clients: { full_name: string } | null; carers: { full_name: string } | null };

const moodColors: Record<string, string> = {
  happy: "bg-green-100 text-green-700",
  neutral: "bg-gray-100 text-gray-700",
  concerned: "bg-amber-100 text-amber-700",
  distressed: "bg-red-100 text-red-700",
};

const typeColors: Record<string, string> = {
  observation: "bg-blue-100 text-blue-700",
  medication: "bg-teal-100 text-teal-700",
  meal: "bg-amber-100 text-amber-700",
  incident: "bg-red-100 text-red-700",
  general: "bg-gray-100 text-gray-700",
};

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; mood?: string; note_type?: string }>;
}) {
  const { search, mood, note_type } = await searchParams;
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  const orgId = admin?.org_id ?? "";

  let query = supabase
    .from("care_notes")
    .select("*, clients(full_name), carers(full_name)")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (search) query = query.ilike("note_text", `%${search}%`);
  if (mood && mood !== "all") query = query.eq("mood", mood);
  if (note_type && note_type !== "all") query = query.eq("note_type", note_type);

  const { data: notes } = await query.returns<CareNoteRow[]>();

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Care Notes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {notes?.length ?? 0} note{(notes?.length ?? 1) !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <Card className="rounded-xl border border-border/50 shadow-card">
        <CardHeader className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <CardTitle className="text-lg font-semibold">All Care Notes</CardTitle>
          <form className="flex flex-wrap gap-2" method="get">
            <div className="relative flex-1 sm:w-48">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input name="search" placeholder="Search notes..." defaultValue={search} className="pl-9 rounded-xl" />
            </div>
            <select name="mood" className="rounded-xl border border-border/50 bg-background px-3 py-2 text-sm" defaultValue={mood ?? "all"}>
              <option value="all">All Moods</option>
              <option value="happy">Happy</option>
              <option value="neutral">Neutral</option>
              <option value="concerned">Concerned</option>
              <option value="distressed">Distressed</option>
            </select>
            <select name="note_type" className="rounded-xl border border-border/50 bg-background px-3 py-2 text-sm" defaultValue={note_type ?? "all"}>
              <option value="all">All Types</option>
              <option value="observation">Observation</option>
              <option value="medication">Medication</option>
              <option value="meal">Meal</option>
              <option value="incident">Incident</option>
              <option value="general">General</option>
            </select>
            <Button type="submit" variant="outline" size="sm" className="rounded-xl">Filter</Button>
            {(search || (mood && mood !== "all") || (note_type && note_type !== "all")) && (
              <Button type="button" variant="ghost" size="sm" className="rounded-xl" onClick={() => window.location.href = "/dashboard/notes"}>Clear</Button>
            )}
          </form>
        </CardHeader>
        <CardContent>
          {(!notes || notes.length === 0) ? (
            <EmptyState
              icon={FileText}
              title={search ? "No matching notes" : "No care notes yet"}
              description={search ? "Try a different search term." : "Care notes will appear here once carers submit them."}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-medium text-muted-foreground">Note</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Client</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Carer</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Type</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Mood</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Date</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground"><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notes.map((note) => (
                    <TableRow key={note.id} className="group">
                      <TableCell className="max-w-[280px]">
                        <p className="truncate text-sm">{note.note_text}</p>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{note.clients?.full_name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{note.carers?.full_name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge className={`rounded-md text-[10px] ${typeColors[note.note_type] ?? "bg-gray-100 text-gray-700"}`}>
                          {note.note_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {note.mood ? (
                          <Badge className={`rounded-md text-[10px] ${moodColors[note.mood] ?? "bg-gray-100 text-gray-700"}`}>
                            {note.mood}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        <Clock className="inline h-3 w-3 mr-1" />
                        {new Date(note.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Link href={note.client_id ? `/dashboard/clients/${note.client_id}` : "#"}>
                          <Button variant="ghost" size="sm" className="gap-1.5 rounded-lg text-xs font-medium text-primary hover:text-primary">
                            View Client <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
