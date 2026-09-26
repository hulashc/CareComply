import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";
import { WebSocket } from "ws";

function loadEnv(path: string) {
  const text = readFileSync(path, "utf-8");
  const env: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return env;
}

const env = loadEnv(resolve(__dirname, "../.env.local"));
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: WebSocket },
});

// ── Helpers ────────────────────────────────────────────────────────────────
function dateStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split("T")[0];
}

function now(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const force = process.argv.includes("--force");

  // 1. Find the org
  const { data: orgs, error: orgErr } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("name", "Heritage Healthcare Leicester");

  if (orgErr) throw new Error("Find org: " + orgErr.message);
  if (!orgs || orgs.length === 0) throw new Error('No org named "Heritage Healthcare Leicester" found');

  const orgId = orgs[0].id;
  console.log(`\n  Org: ${orgs[0].name} (${orgId})\n`);

  // 2. Delete existing data if --force
  if (force) {
    console.log("  Deleting existing data...");
    const tables = [
      "medication_logs", "medications", "care_notes", "tasks", "handover_notes",
      "absences", "incidents", "care_plans", "assessments", "shifts",
      "qualifications", "documents", "document_types", "locations", "carers", "clients",
    ];
    for (const t of tables) {
      const { error } = await supabase.from(t).delete().eq("org_id", orgId);
      if (error) console.error(`    ${t}: ${error.message}`);
      else console.log(`    ${t}: cleared`);
    }
    console.log("");
  }

  // 3. Check existing
  const { data: existingCarers } = await supabase.from("carers").select("id").eq("org_id", orgId).limit(1);
  if (existingCarers && existingCarers.length > 0) {
    console.log("  Seed data already exists. Run with --force to re-seed.\n");
    process.exit(0);
  }

  // 4. Get admin
  const { data: admins } = await supabase.from("admins").select("id").eq("org_id", orgId).limit(1);
  const adminId = admins?.[0]?.id!;

  // ── Locations ──────────────────────────────────────────────────────────
  const { data: locs } = await supabase.from("locations").insert([
    { org_id: orgId, name: "Heritage House", address: "123 London Road, Leicester LE2 1AB", phone: "0116 255 1001", email: "heritage.house@heritagecare.co.uk" },
    { org_id: orgId, name: "Willow Court", address: "45 Park Avenue, Leicester LE3 5FG", phone: "0116 255 2002", email: "willow.court@heritagecare.co.uk" },
    { org_id: orgId, name: "Oakwood Manor", address: "78 High Street, Leicester LE1 4GH", phone: "0116 255 3003", email: "oakwood.manor@heritagecare.co.uk" },
  ]).select();
  const [hh, wc, om] = locs!;
  console.log(`  Locations: ${locs!.length}`);

  // ── Document Types ─────────────────────────────────────────────────────
  const { data: dts } = await supabase.from("document_types").insert([
    { org_id: orgId, name: "DBS Check", applies_to: "carer", is_mandatory: true, renewal_lead_days: 365 },
    { org_id: orgId, name: "First Aid Certificate", applies_to: "carer", is_mandatory: true, renewal_lead_days: 90 },
    { org_id: orgId, name: "Manual Handling", applies_to: "carer", is_mandatory: true, renewal_lead_days: 180 },
    { org_id: orgId, name: "Safeguarding Adults", applies_to: "carer", is_mandatory: true, renewal_lead_days: 180 },
    { org_id: orgId, name: "Medication Administration", applies_to: "carer", is_mandatory: false, renewal_lead_days: 180 },
    { org_id: orgId, name: "Right to Work", applies_to: "carer", is_mandatory: true, renewal_lead_days: 365 },
  ]).select();
  console.log(`  Document Types: ${dts!.length}`);

  // ── Clients ─────────────────────────────────────────────────────────────
  const { data: cli } = await supabase.from("clients").insert([
    { org_id: orgId, location_id: hh.id, full_name: "Eleanor Whitmore", dob: "1946-02-14", address: "Room 12, Heritage House, Leicester LE2 1AB", emergency_contact_name: "James Whitmore (son)", emergency_contact_phone: "07700 100200", care_notes: "Dementia care. Requires supervision during meals. Enjoys classical music." },
    { org_id: orgId, location_id: hh.id, full_name: "George Harrison", dob: "1939-08-25", address: "Room 8, Heritage House, Leicester LE2 1AB", emergency_contact_name: "Anne Harrison (daughter)", emergency_contact_phone: "07700 100201", care_notes: "Mobility issues — uses walking frame. Needs assistance with transfers. Physio twice weekly." },
    { org_id: orgId, location_id: wc.id, full_name: "Margaret Thatcher", dob: "1950-05-10", address: "Room 3, Willow Court, Leicester LE3 5FG", emergency_contact_name: "Carol Thatcher (daughter)", emergency_contact_phone: "07700 100202", care_notes: "Post-surgery recovery (hip replacement). Pain management. Occupational therapy ongoing." },
    { org_id: orgId, location_id: wc.id, full_name: "Robert Browning", dob: "1933-11-30", address: "Room 6, Willow Court, Leicester LE3 5FG", emergency_contact_name: "Michael Brown (nephew)", emergency_contact_phone: "07700 100203", care_notes: "Full-time care. Incontinent. Pressure area care. Pureed diet. Family visits every Sunday." },
    { org_id: orgId, location_id: om.id, full_name: "Patricia Langford", dob: "1955-07-22", address: "Room 10, Oakwood Manor, Leicester LE1 4GH", emergency_contact_name: "John Langford (husband)", emergency_contact_phone: "07700 100204", care_notes: "Parkinson's disease. Medication at 8am, 2pm, 8pm. Needs assistance with fine motor tasks." },
    { org_id: orgId, location_id: om.id, full_name: "Arthur Pendleton", dob: "1941-03-15", address: "Room 5, Oakwood Manor, Leicester LE1 4GH", emergency_contact_name: "Susan Pendleton (wife)", emergency_contact_phone: "07700 100205", care_notes: "Type 2 diabetes. Blood sugar monitoring before meals. Insulin at 9pm. Dietary restrictions." },
    { org_id: orgId, location_id: hh.id, full_name: "Dorothy Green", dob: "1948-09-05", address: "Room 2, Heritage House, Leicester LE2 1AB", emergency_contact_name: "Paul Green (son)", emergency_contact_phone: "07700 100206", care_notes: "Stroke recovery — left-sided weakness. Speech therapy. Needs assistance with dressing and bathing." },
    { org_id: orgId, location_id: wc.id, full_name: "Stanley Hudson", dob: "1953-12-18", address: "Room 9, Willow Court, Leicester LE3 5FG", emergency_contact_name: "Linda Hudson (daughter)", emergency_contact_phone: "07700 100207", care_notes: "COPD. Oxygen therapy at 2L/min. Breathing exercises. Nebuliser 4x daily. No heavy meals." },
  ]).select();
  const allClients = cli!;
  console.log(`  Clients: ${allClients.length}`);

  // ── Carers ──────────────────────────────────────────────────────────────
  const { data: carers } = await supabase.from("carers").insert([
    { org_id: orgId, location_id: hh.id, full_name: "Sarah Mitchell", email: "sarah.mitchell@heritagecare.co.uk", phone: "07700 100100", role: "senior_carer", start_date: "2023-03-01", notes: "Team lead at Heritage House. Specialises in dementia care." },
    { org_id: orgId, location_id: hh.id, full_name: "James O'Brien", email: "james.obrien@heritagecare.co.uk", phone: "07700 100101", role: "carer", start_date: "2023-06-15", notes: "Full-time carer. Good with mobility assistance." },
    { org_id: orgId, location_id: wc.id, full_name: "Priya Patel", email: "priya.patel@heritagecare.co.uk", phone: "07700 100102", role: "carer", start_date: "2024-01-10", notes: "Part-time. Studying nursing at De Montfort University." },
    { org_id: orgId, location_id: wc.id, full_name: "David Thompson", email: "david.thompson@heritagecare.co.uk", phone: "07700 100103", role: "carer", start_date: "2022-11-01", notes: "Experienced carer. Specialises in end-of-life care." },
    { org_id: orgId, location_id: om.id, full_name: "Emily Watson", email: "emily.watson@heritagecare.co.uk", phone: "07700 100104", role: "carer", start_date: "2023-09-20", notes: "Morning shifts. Excellent medication management skills." },
    { org_id: orgId, location_id: om.id, full_name: "Mohammed Ali", email: "mohammed.ali@heritagecare.co.uk", phone: "07700 100105", role: "carer", start_date: "2024-04-01", notes: "Newest team member. Eager to learn. Good with technology." },
    { org_id: orgId, location_id: hh.id, full_name: "Lucy Chen", email: "lucy.chen@heritagecare.co.uk", phone: "07700 100106", role: "carer", start_date: "2022-08-14", notes: "Night shift specialist. Monitors residents overnight." },
    { org_id: orgId, location_id: wc.id, full_name: "Thomas Clarke", email: "thomas.clarke@heritagecare.co.uk", phone: "07700 100107", role: "carer", start_date: "2023-04-01", notes: "Weekend carer. Also works as a support worker." },
    { org_id: orgId, location_id: om.id, full_name: "Rebecca Jones", email: "rebecca.jones@heritagecare.co.uk", phone: "07700 100108", role: "carer", start_date: "2023-01-15", notes: "Flexible shifts. Speaks Welsh. Good rapport with families." },
    { org_id: orgId, location_id: wc.id, full_name: "Daniel Williams", email: "daniel.williams@heritagecare.co.uk", phone: "07700 100109", role: "senior_carer", start_date: "2022-06-01", notes: "Team lead at Willow Court. Advanced first aid certified." },
  ]).select();
  const allCarers = carers!;
  console.log(`  Carers: ${allCarers.length}`);

  // ── Shifts ──────────────────────────────────────────────────────────────
  const shiftDurations = [
    { start: "07:00", end: "15:00" }, { start: "08:00", end: "16:00" },
    { start: "09:00", end: "17:00" }, { start: "14:00", end: "22:00" },
    { start: "15:00", end: "23:00" },
  ];
  const shiftInserts: any[] = [];
  for (let d = -21; d <= 14; d++) {
    const dayStr = dateStr(d);
    const numShifts = 4 + Math.floor(Math.random() * 3);
    for (let s = 0; s < numShifts; s++) {
      const sd = randomItem(shiftDurations);
      const carer = randomItem(allCarers);
      const client = randomItem(allClients);
      const isPast = d < 0;
      let status = "scheduled";
      if (isPast) {
        status = Math.random() < 0.2 ? "cancelled" : "completed";
      } else if (d === 0 && parseInt(sd.start) < new Date().getHours()) {
        status = Math.random() < 0.3 ? "in_progress" : "scheduled";
      }
      shiftInserts.push({
        org_id: orgId, client_id: client.id, carer_id: carer.id,
        location_id: carer.location_id,
        start_time: `${dayStr}T${sd.start}:00.000Z`,
        end_time: `${dayStr}T${sd.end}:00.000Z`,
        status,
      });
    }
  }
  const { data: shifts, error: shErr } = await supabase.from("shifts").insert(shiftInserts).select();
  if (shErr) throw new Error("Shifts: " + shErr.message);
  console.log(`  Shifts: ${shifts!.length}`);

  // ── Tasks ───────────────────────────────────────────────────────────────
  const taskTemplates = [
    { title: "Morning medication check", category: "medication", priority: "high" },
    { title: "Assist with breakfast", category: "nutrition", priority: "medium" },
    { title: "Mobility exercise", category: "physio", priority: "medium" },
    { title: "Bathroom assistance", category: "personal_care", priority: "high" },
    { title: "Laundry and linen change", category: "housekeeping", priority: "low" },
    { title: "Family update call", category: "communication", priority: "medium" },
    { title: "Fluid intake monitoring", category: "nutrition", priority: "medium" },
    { title: "Change dressing", category: "medical", priority: "high" },
  ];
  const taskInserts: any[] = [];
  allClients.forEach((client) => {
    const numTasks = 3 + Math.floor(Math.random() * 5);
    for (let t = 0; t < numTasks; t++) {
      const tmpl = randomItem(taskTemplates);
      const isCompleted = Math.random() < 0.65;
      const daysAgo = Math.floor(Math.random() * 14);
      taskInserts.push({
        org_id: orgId, client_id: client.id, carer_id: randomItem(allCarers).id,
        title: tmpl.title, category: tmpl.category, priority: tmpl.priority,
        status: isCompleted ? "completed" : randomItem(["pending", "in_progress"]),
        due_date: isCompleted ? dateStr(-daysAgo) : dateStr(Math.floor(Math.random() * 7)),
        completed_at: isCompleted ? now(-daysAgo) : null,
      });
    }
  });
  const { error: taskErr } = await supabase.from("tasks").insert(taskInserts);
  if (taskErr) throw new Error("Tasks: " + taskErr.message);
  console.log(`  Tasks: ${taskInserts.length}`);

  // ── Care Notes ──────────────────────────────────────────────────────────
  const completedShifts = shifts!.filter((s) => s.status === "completed").slice(0, 80);
  const moods = ["happy", "calm", "anxious", "tired", "confused", "agitated", "peaceful"];
  const noteTexts = [
    "Client had a good day. Ate well at breakfast and lunch.",
    "Slept through the night without disturbance. Morning routine completed.",
    "Seemed slightly anxious this morning. Reassured and settled after breakfast.",
    "Mobility exercise completed. Walked to the garden with assistance.",
    "Medication taken on time. No side effects observed.",
    "Family visited today. Client was in high spirits.",
    "Refused breakfast initially but ate well at lunchtime.",
    "Slight cough noted. Monitored throughout shift. No temperature.",
  ];
  const careNoteInserts = completedShifts.map((s) => {
    const shiftStart = new Date(s.start_time);
    return {
      org_id: orgId, client_id: s.client_id, carer_id: s.carer_id,
      note_type: randomItem(["observation", "medication", "mobility", "nutrition", "general"]),
      note_text: randomItem(noteTexts),
      mood: randomItem(moods),
      fluids: randomItem(["500ml", "750ml", "1000ml"]),
      nutrition: randomItem(["Full meal eaten", "Most of meal eaten", "Ate half", "Refused food"]),
      created_at: new Date(shiftStart.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    };
  });
  const { error: cnErr } = await supabase.from("care_notes").insert(careNoteInserts);
  if (cnErr) throw new Error("Care Notes: " + cnErr.message);
  console.log(`  Care Notes: ${careNoteInserts.length}`);

  // ── Handovers ───────────────────────────────────────────────────────────
  const groupedByClient: Record<string, any[]> = {};
  completedShifts.forEach((s) => {
    if (!groupedByClient[s.client_id]) groupedByClient[s.client_id] = [];
    groupedByClient[s.client_id].push(s);
  });
  const handoverInserts: any[] = [];
  Object.values(groupedByClient).forEach((shiftsForClient) => {
    shiftsForClient.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    for (let i = 0; i < shiftsForClient.length - 1; i++) {
      const fromS = shiftsForClient[i], toS = shiftsForClient[i + 1];
      if (fromS.carer_id !== toS.carer_id) {
        handoverInserts.push({
          org_id: orgId, client_id: fromS.client_id, from_carer_id: fromS.carer_id,
          to_carer_id: toS.carer_id, shift_id: fromS.id,
          note_text: `Handover for shift ending at ${fromS.end_time}. All tasks completed.`,
          mood: randomItem(moods),
          concerns: Math.random() < 0.4 ? randomItem(["Mild confusion noted", "Slight cough persists", "Pain reported"]) : null,
          tasks_completed: "Morning care, medication, breakfast assistance",
          is_read: Math.random() < 0.5,
          created_at: fromS.end_time,
        });
      }
    }
  });
  const { error: hoErr } = await supabase.from("handover_notes").insert(handoverInserts.slice(0, 40));
  if (hoErr) throw new Error("Handovers: " + hoErr.message);
  console.log(`  Handover Notes: ${Math.min(handoverInserts.length, 40)}`);

  // ── Incident ────────────────────────────────────────────────────────────
  const incInserts = [
    { org_id: orgId, client_id: allClients[0].id, carer_id: allCarers[0].id, severity: "low", category: "fall", title: "Minor slip in bathroom", description: "Client Eleanor slipped in bathroom but was caught by carer before hitting the floor. No injuries sustained.", action_taken: "Verbally reported to senior carer. Logged in system.", status: "resolved", reported_at: now(-14), resolved_at: now(-12) },
    { org_id: orgId, client_id: allClients[1].id, carer_id: allCarers[1].id, severity: "medium", category: "medication", title: "Missed medication dose", description: "Morning medication for client George was administered 45 minutes late due to scheduling confusion.", action_taken: "Verbally reported to senior carer. Logged in system.", status: "resolved", reported_at: now(-10), resolved_at: now(-9) },
    { org_id: orgId, client_id: allClients[2].id, carer_id: allCarers[2].id, severity: "low", category: "behavioral", title: "Client refused care", description: "Client Margaret refused personal care this morning. Became verbally agitated when carer insisted. Later accepted care from senior carer.", action_taken: "Verbally reported to senior carer. Logged in system.", status: "open", reported_at: now(-5) },
    { org_id: orgId, client_id: allClients[3].id, carer_id: allCarers[3].id, severity: "high", category: "fall", title: "Client found on floor", description: "Client Robert found on floor beside bed at 3am. No visible injuries. Checked by on-call nurse. Increased bed rail monitoring implemented.", action_taken: "On-call nurse notified. Incident report filed. Family informed.", status: "open", reported_at: now(-2) },
    { org_id: orgId, client_id: allClients[7].id, carer_id: allCarers[4].id, severity: "medium", category: "other", title: "Water damage in room 9", description: "Overflowing toilet caused water damage to floor. Maintenance called. Client moved to temporary room.", action_taken: "Verbally reported to senior carer. Logged in system.", status: "open", reported_at: now(-1) },
  ];
  const { error: incErr } = await supabase.from("incidents").insert(incInserts);
  if (incErr) throw new Error("Incidents: " + incErr.message);
  console.log(`  Incidents: ${incInserts.length}`);

  // ── Absences ────────────────────────────────────────────────────────────
  const { error: abErr } = await supabase.from("absences").insert([
    { carer_id: allCarers[1].id, org_id: orgId, absence_type: "sick_leave", start_date: dateStr(-10), end_date: dateStr(-8), status: "approved", reason: "Flu symptoms", approved_by: adminId, approved_at: now(-11) },
    { carer_id: allCarers[2].id, org_id: orgId, absence_type: "holiday", start_date: dateStr(14), end_date: dateStr(21), status: "approved", reason: "Annual leave - family holiday to Spain", approved_by: adminId, approved_at: now(-5) },
    { carer_id: allCarers[6].id, org_id: orgId, absence_type: "sick_leave", start_date: dateStr(-2), end_date: dateStr(-1), status: "approved", reason: "Migraine", approved_by: adminId, approved_at: now(-3) },
    { carer_id: allCarers[7].id, org_id: orgId, absence_type: "sick_leave", start_date: dateStr(0), end_date: dateStr(1), status: "pending", reason: "Feeling unwell" },
  ]);
  if (abErr) throw new Error("Absences: " + abErr.message);
  console.log(`  Absences: 4`);

  // ── Medications ─────────────────────────────────────────────────────────
  const medList = [
    { drug: "Paracetamol", dosage: "500mg", frequency: "4 times daily", route: "oral" },
    { drug: "Omeprazole", dosage: "20mg", frequency: "Once daily", route: "oral" },
    { drug: "Amlodipine", dosage: "5mg", frequency: "Once daily", route: "oral" },
    { drug: "Metformin", dosage: "500mg", frequency: "Twice daily", route: "oral" },
    { drug: "Salbutamol", dosage: "100mcg", frequency: "As required", route: "inhalation" },
    { drug: "Furosemide", dosage: "40mg", frequency: "Once daily", route: "oral" },
  ];
  const medInserts = allClients.flatMap((client) => {
    const picked = [randomItem(medList), randomItem(medList)];
    return picked.map((m) => ({
      org_id: orgId, client_id: client.id, drug_name: m.drug, dosage: m.dosage,
      frequency: m.frequency, route: m.route,
      start_date: dateStr(-180 - Math.floor(Math.random() * 180)),
      prescribed_by: "Dr. Katherine Ellis, Leicester Royal Infirmary",
      status: "active",
    }));
  });
  const { data: medications, error: medErr } = await supabase.from("medications").insert(medInserts).select();
  if (medErr) throw new Error("Medications: " + medErr.message);
  console.log(`  Medications: ${medInserts.length}`);

  // ── Medication Logs ────────────────────────────────────────────────────
  const medLogInserts = completedShifts.slice(0, 40).flatMap((s) => {
    const clientMeds = medications!.filter((m) => m.client_id === s.client_id);
    return clientMeds.slice(0, 1).map((m) => ({
      org_id: orgId, medication_id: m.id, carer_id: s.carer_id,
      administered_at: new Date(new Date(s.start_time).getTime() + 60 * 60 * 1000).toISOString(),
      status: randomItem(["given", "given", "given", "refused"]),
    }));
  });
  const { error: mlErr } = await supabase.from("medication_logs").insert(medLogInserts);
  if (mlErr) throw new Error("Med Logs: " + mlErr.message);
  console.log(`  Medication Logs: ${medLogInserts.length}`);

  // ── Care Plans ─────────────────────────────────────────────────────────
  const { error: cpErr } = await supabase.from("care_plans").insert(
    allClients.map((client) => ({
      org_id: orgId, client_id: client.id,
      title: `Care Plan for ${client.full_name}`,
      goals: "Maintain independence where possible. Ensure safety and dignity. Regular monitoring of health conditions.",
      interventions: "Daily personal care. Medication management. Mobility assistance. Nutritional support.",
      notes: client.care_notes, status: "active",
      review_date: dateStr(90 - Math.floor(Math.random() * 30)),
      created_by: adminId,
    }))
  );
  if (cpErr) throw new Error("Care Plans: " + cpErr.message);
  console.log(`  Care Plans: ${allClients.length}`);

  // ── Qualifications ─────────────────────────────────────────────────────
  const qualData = [
    ["NVQ Level 3", "2022-01-15", "2027-01-15"],
    ["NVQ Level 2", "2021-06-01", "2026-06-01"],
    ["NVQ Level 3", "2023-03-10", "2028-03-10"],
    ["NVQ Level 4", "2020-09-20", "2025-09-20"],
    ["NVQ Level 2", "2022-11-05", "2027-11-05"],
    ["NVQ Level 1", "2024-04-01", "2029-04-01"],
    ["NVQ Level 3", "2021-08-14", "2026-08-14"],
    ["NVQ Level 2", "2023-04-01", "2028-04-01"],
    ["NVQ Level 3", "2022-01-15", "2027-01-15"],
    ["NVQ Level 4", "2021-06-01", "2026-06-01"],
  ];
  const { error: qErr } = await supabase.from("qualifications").insert(
    allCarers.map((c, i) => ({
      carer_id: c.id, org_id: orgId,
      qualification_type: qualData[i][0],
      status: "valid",
      issued_date: qualData[i][1],
      expiry_date: qualData[i][2],
    }))
  );
  if (qErr) throw new Error("Qualifications: " + qErr.message);
  console.log(`  Qualifications: ${allCarers.length}`);

  // ── Documents (2-3 per carer) ──────────────────────────────────────────
  const docInserts: any[] = [];
  allCarers.forEach((c) => {
    const dtList = dts!;
    const picked = dtList.slice(0, 2 + Math.floor(Math.random() * 2));
    picked.forEach((dt) => {
      const isExpired = Math.random() < 0.2;
      docInserts.push({
        org_id: orgId, owner_id: c.id, owner_type: "carer",
        document_type_id: dt.id,
        status: isExpired ? "red" : "green",
        expiry_date: isExpired ? dateStr(-30) : dateStr(60 + Math.floor(Math.random() * 300)),
      });
    });
  });
  const { error: docErr } = await supabase.from("documents").insert(docInserts);
  if (docErr) throw new Error("Documents: " + docErr.message);
  console.log(`  Documents: ${docInserts.length}`);

  // ── Done ───────────────────────────────────────────────────────────────
  console.log(`\n  ✅ Done. ${allCarers.length} carers + ${allClients.length} clients seeded for ${orgs[0].name}.\n`);
}

main().catch((err) => {
  console.error("\n  ❌ Error:", err.message, "\n");
  process.exit(1);
});
