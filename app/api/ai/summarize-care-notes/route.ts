import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { rateLimit } from "@/lib/rate-limit";
import { generateObject } from "ai";
import { getModel } from "@/lib/ai/client";
import { summarizeCareNotes } from "@/lib/ai/prompts";

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const rl = await rateLimit(`summarize-notes:${admin.id}`, 5);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { client_id, start_date, end_date } = body;

  if (!client_id || !start_date || !end_date) {
    return NextResponse.json({ error: "client_id, start_date, and end_date are required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: client } = await supabase
    .from("clients")
    .select("full_name")
    .eq("id", client_id)
    .eq("org_id", admin.org_id ?? "")
    .maybeSingle();

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const { data: notes } = await supabase
    .from("care_notes")
    .select("note_text, mood, fluids, nutrition, created_at")
    .eq("client_id", client_id)
    .eq("org_id", admin.org_id ?? "")
    .gte("created_at", start_date)
    .lte("created_at", end_date)
    .order("created_at", { ascending: true });

  if (!notes || notes.length === 0) {
    return NextResponse.json({ summary: "No care notes found for this period.", mood_trend: "unknown", concerns: [] });
  }

  const notesText = notes.map((n: { note_text: string; mood?: string | null; fluids?: string | null; nutrition?: string | null; created_at: string }) =>
    `[${n.created_at?.split("T")[0]}] Mood: ${n.mood || "not recorded"} | Fluids: ${n.fluids || "not recorded"} | Nutrition: ${n.nutrition || "not recorded"} | ${n.note_text}`
  ).join("\n");

  try {
    const { object } = await generateObject({
      model: getModel(),
      prompt: summarizeCareNotes(client.full_name, start_date, end_date, notesText),
      output: "no-schema",
    });
    return NextResponse.json({ ...(object as Record<string, unknown>), note_count: notes.length });
  } catch {
    return NextResponse.json({
      summary: `Found ${notes.length} care notes for ${client.full_name} in this period. AI summarization unavailable.`,
      mood_trend: "unknown",
      concerns: [],
      note_count: notes.length,
    });
  }
}
