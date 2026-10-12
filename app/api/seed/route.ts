import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/services/auth-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables, TablesInsert } from "@/lib/database.types";

function now(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
}

function dateStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split("T")[0];
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function POST() {
  try {
    const supabase = createAdminClient();
    const admin = await requireAdmin();
    const orgId = admin.org_id;
    if (!orgId) {
      return NextResponse.json({ error: "Admin organization not found" }, { status: 404 });
    }

    const { data: existing } = await supabase.from("carers").select("id").eq("org_id", orgId).limit(1);
    if (existing && existing.length > 0) {
      return NextResponse.json({ error: "Seed data already exists for this org. Delete existing data first if you want to reseed." }, { status: 409 });
    }

    const adminId = admin.id;

    // ── Locations ──────────────────────────────────────────────────────
    const locations = [
      { org_id: orgId, name: "Heritage House", address: "123 London Road, Leicester LE2 1AB", phone: "0116 255 1001", email: "heritage.house@heritagecare.co.uk" },
      { org_id: orgId, name: "Willow Court", address: "45 Park Avenue, Leicester LE3 5FG", phone: "0116 255 2002", email: "willow.court@heritagecare.co.uk" },
      { org_id: orgId, name: "Oakwood Manor", address: "78 High Street, Leicester LE1 4GH", phone: "0116 255 3003", email: "oakwood.manor@heritagecare.co.uk" },
    ];
    const { data: locs, error: locErr } = await supabase.from("locations").insert(locations).select();
    if (locErr) throw new Error("Locations: " + locErr.message);
    const [hh, wc, om] = locs!;

    // ── Document Types ─────────────────────────────────────────────────
    const docTypes = [
      { org_id: orgId, name: "DBS Check", applies_to: "carer", is_mandatory: true, renewal_lead_days: 365 },
      { org_id: orgId, name: "First Aid Certificate", applies_to: "carer", is_mandatory: true, renewal_lead_days: 90 },
      { org_id: orgId, name: "Manual Handling", applies_to: "carer", is_mandatory: true, renewal_lead_days: 180 },
      { org_id: orgId, name: "Safeguarding Adults", applies_to: "carer", is_mandatory: true, renewal_lead_days: 180 },
      { org_id: orgId, name: "Medication Administration", applies_to: "carer", is_mandatory: false, renewal_lead_days: 180 },
      { org_id: orgId, name: "Right to Work", applies_to: "carer", is_mandatory: true, renewal_lead_days: 365 },
    ];
    const { data: dts, error: dtErr } = await supabase.from("document_types").insert(docTypes).select();
    if (dtErr) throw new Error("DocTypes: " + dtErr.message);

    // ── Clients (8) ─────────────────────────────────────────────────────
    const clients = [
      { org_id: orgId, location_id: hh.id, full_name: "Eleanor Whitmore", dob: "1946-02-14", address: "Room 12, Heritage House, Leicester LE2 1AB", emergency_contact_name: "James Whitmore (son)", emergency_contact_phone: "07700 100200", care_notes: "Dementia care. Requires supervision during meals. Enjoys classical music." },
      { org_id: orgId, location_id: hh.id, full_name: "George Harrison", dob: "1939-08-25", address: "Room 8, Heritage House, Leicester LE2 1AB", emergency_contact_name: "Anne Harrison (daughter)", emergency_contact_phone: "07700 100201", care_notes: "Mobility issues — uses walking frame. Needs assistance with transfers. Physio twice weekly." },
      { org_id: orgId, location_id: wc.id, full_name: "Margaret Thatcher", dob: "1950-05-10", address: "Room 3, Willow Court, Leicester LE3 5FG", emergency_contact_name: "Carol Thatcher (daughter)", emergency_contact_phone: "07700 100202", care_notes: "Post-surgery recovery (hip replacement). Pain management. Occupational therapy ongoing." },
      { org_id: orgId, location_id: wc.id, full_name: "Robert Browning", dob: "1933-11-30", address: "Room 6, Willow Court, Leicester LE3 5FG", emergency_contact_name: "Michael Brown (nephew)", emergency_contact_phone: "07700 100203", care_notes: "Full-time care. Incontinent. Pressure area care. Pureed diet. Family visits every Sunday." },
      { org_id: orgId, location_id: om.id, full_name: "Patricia Langford", dob: "1955-07-22", address: "Room 10, Oakwood Manor, Leicester LE1 4GH", emergency_contact_name: "John Langford (husband)", emergency_contact_phone: "07700 100204", care_notes: "Parkinson's disease. Medication at 8am, 2pm, 8pm. Needs assistance with fine motor tasks." },
      { org_id: orgId, location_id: om.id, full_name: "Arthur Pendleton", dob: "1941-03-15", address: "Room 5, Oakwood Manor, Leicester LE1 4GH", emergency_contact_name: "Susan Pendleton (wife)", emergency_contact_phone: "07700 100205", care_notes: "Type 2 diabetes. Blood sugar monitoring before meals. Insulin at 9pm. Dietary restrictions." },
      { org_id: orgId, location_id: hh.id, full_name: "Dorothy Green", dob: "1948-09-05", address: "Room 2, Heritage House, Leicester LE2 1AB", emergency_contact_name: "Paul Green (son)", emergency_contact_phone: "07700 100206", care_notes: "Stroke recovery — left-sided weakness. Speech therapy. Needs assistance with dressing and bathing." },
      { org_id: orgId, location_id: wc.id, full_name: "Stanley Hudson", dob: "1953-12-18", address: "Room 9, Willow Court, Leicester LE3 5FG", emergency_contact_name: "Linda Hudson (daughter)", emergency_contact_phone: "07700 100207", care_notes: "COPD. Oxygen therapy at 2L/min. Breathing exercises. Nebuliser 4x daily. No heavy meals." },
    ];
    const { data: cli, error: cliErr } = await supabase.from("clients").insert(clients).select();
    if (cliErr) throw new Error("Clients: " + cliErr.message);

    // ── Carers (10) ─────────────────────────────────────────────────────
    const carersData = [
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
    ];
    const { data: carers, error: carErr } = await supabase.from("carers").insert(carersData).select();
    if (carErr) throw new Error("Carers: " + carErr.message);
    const [, james, priya, , , , lucy, thomas] = carers!;

    // ── Qualifications (one per carer) ──────────────────────────────────
    const quals = carers!.map((c, i) => ({
      carer_id: c.id,
      org_id: orgId,
      qualification_type: ["NVQ Level 2", "NVQ Level 3", "NVQ Level 3", "NVQ Level 4", "NVQ Level 2", "NVQ Level 1", "NVQ Level 3", "NVQ Level 2", "NVQ Level 3", "NVQ Level 4"][i],
      status: "valid",
      issued_date: dateStr(-365 * (1 + Math.floor(Math.random() * 3))),
      expiry_date: dateStr(365 * (1 + Math.floor(Math.random() * 2))),
    }));
    const { error: qErr } = await supabase.from("qualifications").insert(quals);
    if (qErr) throw new Error("Qualifications: " + qErr.message);

    // ── Documents (2-3 per carer, plus some expired/pending) ───────────
    const docInserts: TablesInsert<"documents">[] = [];
    carers!.forEach((c) => {
      const dtList = dts!;
      const picked = dtList.slice(0, 2 + Math.floor(Math.random() * 2));
      picked.forEach((dt) => {
        const isExpired = Math.random() < 0.2;
        docInserts.push({
          org_id: orgId,
          owner_id: c.id,
          owner_type: "carer",
          document_type_id: dt.id,
          status: isExpired ? "expired" : "green",
          expiry_date: isExpired ? dateStr(-30) : dateStr(60 + Math.floor(Math.random() * 300)),
          uploaded_at: dateStr(-90 + Math.floor(Math.random() * 60)),
        });
      });
    });
    const { error: docErr } = await supabase.from("documents").insert(docInserts);
    if (docErr) throw new Error("Documents: " + docErr.message);

    // ── Shifts (past 14 days + next 7 days, 4-6 per day) ──────────────
    const shiftInserts: TablesInsert<"shifts">[] = [];
    const allCarers = carers!;
    const allClients = cli!;
    const shiftDurations = [
      { start: "07:00", end: "15:00" },
      { start: "08:00", end: "16:00" },
      { start: "09:00", end: "17:00" },
      { start: "14:00", end: "22:00" },
      { start: "15:00", end: "23:00" },
      { start: "20:00", end: "08:00" },
      { start: "21:00", end: "09:00" },
      { start: "22:00", end: "08:00" },
    ];

    for (let d = -21; d <= 14; d++) {
      const dayStr = dateStr(d);
      const numShifts = 4 + Math.floor(Math.random() * 3);
      for (let s = 0; s < numShifts; s++) {
        const sd = randomItem(shiftDurations);
        const carer = randomItem(allCarers);
        const client = randomItem(allClients);
        const isPast = d < 0;
        const isToday = d === 0;
        let status = "scheduled";
        if (isPast) {
          status = Math.random() < 0.2 ? "cancelled" : "completed";
        } else if (isToday && parseInt(sd.start) < new Date().getHours()) {
          status = Math.random() < 0.3 ? "in_progress" : "scheduled";
        }
        shiftInserts.push({
          org_id: orgId,
          client_id: client.id,
          carer_id: carer.id,
          location_id: carer.location_id,
          start_time: `${dayStr}T${sd.start}:00.000Z`,
          end_time: `${dayStr}T${sd.end}:00.000Z`,
          status,
          notes: Math.random() < 0.3 ? `Shift notes for ${client.full_name}` : null,
        });
      }
    }
    const { data: shifts, error: shErr } = await supabase.from("shifts").insert(shiftInserts).select();
    if (shErr) throw new Error("Shifts: " + shErr.message);

    // ── Tasks (per client, both open and completed) ─────────────────────
    const taskTemplates = [
      { title: "Morning medication check", category: "medication", priority: "high" },
      { title: "Assist with breakfast", category: "nutrition", priority: "medium" },
      { title: "Mobility exercise", category: "physio", priority: "medium" },
      { title: "Bathroom assistance", category: "personal_care", priority: "high" },
      { title: "Laundry and linen change", category: "housekeeping", priority: "low" },
      { title: "Family update call", category: "communication", priority: "medium" },
      { title: "Evening medication", category: "medication", priority: "high" },
      { title: "Fluid intake monitoring", category: "nutrition", priority: "medium" },
      { title: "Change dressing", category: "medical", priority: "high" },
      { title: "Prepare for bedtime", category: "personal_care", priority: "medium" },
    ];
    const taskInserts: TablesInsert<"tasks">[] = [];
    allClients.forEach((client) => {
      const numTasks = 3 + Math.floor(Math.random() * 5);
      for (let t = 0; t < numTasks; t++) {
        const tmpl = randomItem(taskTemplates);
        const isCompleted = Math.random() < 0.65;
        const daysAgo = Math.floor(Math.random() * 14);
        taskInserts.push({
          org_id: orgId,
          client_id: client.id,
          carer_id: randomItem(allCarers).id,
          title: tmpl.title,
          category: tmpl.category,
          priority: tmpl.priority,
          status: isCompleted ? "completed" : randomItem(["pending", "in_progress"]),
          due_date: isCompleted ? dateStr(-daysAgo) : dateStr(Math.floor(Math.random() * 7)),
          completed_at: isCompleted ? now(-daysAgo) : null,
        });
      }
    });
    const { error: taskErr } = await supabase.from("tasks").insert(taskInserts);
    if (taskErr) throw new Error("Tasks: " + taskErr.message);

    // ── Care Notes (one per past shift) ────────────────────────────────
    const completedShifts = shifts!.filter((s) => s.status === "completed").slice(0, 60);
    const moods = ["happy", "calm", "anxious", "tired", "confused", "agitated", "peaceful"];
    const noteTexts = [
      "Client had a good day. Ate well at breakfast and lunch.",
      "Slept through the night without disturbance. Morning routine completed.",
      "Seemed slightly anxious this morning. Reassured and settled after breakfast.",
      "Mobility exercise completed. Walked to the garden with assistance.",
      "Medication taken on time. No side effects observed.",
      "Family visited today. Client was in high spirits.",
      "Refused breakfast initially but ate well at lunchtime.",
      "Physio session went well. Improved range of motion in right arm.",
      "Slight cough noted. Monitored throughout shift. No temperature.",
      "Client reported pain in left hip. PRN analgesia administered.",
    ];
    const careNoteInserts = completedShifts.map((s) => {
      const shiftStart = new Date(s.start_time);
      return {
        org_id: orgId,
        client_id: s.client_id,
        carer_id: s.carer_id,
        note_type: randomItem(["observation", "medication", "mobility", "nutrition", "general"]),
        note_text: randomItem(noteTexts),
        mood: randomItem(moods),
        fluids: randomItem(["500ml", "750ml", "1000ml", "1200ml", "1500ml"]),
        nutrition: randomItem(["Full meal eaten", "Most of meal eaten", "Ate half", "Only fluids", "Refused food"]),
        created_at: new Date(shiftStart.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      };
    });
    const { error: cnErr } = await supabase.from("care_notes").insert(careNoteInserts);
    if (cnErr) throw new Error("Care Notes: " + cnErr.message);

    // ── Handover Notes (between shifts) ─────────────────────────────────
    const groupedByClient: Record<string, Tables<"shifts">[]> = {};
    completedShifts.forEach((s) => {
      if (!groupedByClient[s.client_id]) groupedByClient[s.client_id] = [];
      groupedByClient[s.client_id].push(s);
    });
    const handoverInserts: TablesInsert<"handover_notes">[] = [];
    Object.values(groupedByClient).forEach((shiftsForClient) => {
      shiftsForClient.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
      for (let i = 0; i < shiftsForClient.length - 1; i++) {
        const fromShift = shiftsForClient[i];
        const toShift = shiftsForClient[i + 1];
        if (fromShift.carer_id !== toShift.carer_id) {
          handoverInserts.push({
            org_id: orgId,
            client_id: fromShift.client_id,
            from_carer_id: fromShift.carer_id,
            to_carer_id: toShift.carer_id,
            shift_id: fromShift.id,
            note_text: `Handover for shift ending at ${fromShift.end_time}. All tasks completed.`,
            mood: randomItem(moods),
            concerns: Math.random() < 0.4 ? randomItem(["Mild confusion noted", "Slight cough persists", "Pain reported in morning", "Reduced appetite today", "No concerns"]) : null,
            tasks_completed: "Morning care, medication, breakfast assistance",
            tasks_remaining: Math.random() < 0.3 ? "Evening medication pending" : null,
            is_read: Math.random() < 0.5,
            created_at: fromShift.end_time,
          });
        }
      }
    });
    const { error: hoErr } = await supabase.from("handover_notes").insert(handoverInserts.slice(0, 30));
    if (hoErr) throw new Error("Handovers: " + hoErr.message);

    // ── Absences (3-4) ──────────────────────────────────────────────────
    const absences = [
      { carer_id: james!.id, org_id: orgId, absence_type: "sick_leave", start_date: dateStr(-10), end_date: dateStr(-8), status: "approved", reason: "Flu symptoms", approved_by: adminId, approved_at: now(-11) },
      { carer_id: priya!.id, org_id: orgId, absence_type: "holiday", start_date: dateStr(14), end_date: dateStr(21), status: "approved", reason: "Annual leave - family holiday to Spain", approved_by: adminId, approved_at: now(-5) },
      { carer_id: lucy!.id, org_id: orgId, absence_type: "sick_leave", start_date: dateStr(-2), end_date: dateStr(-1), status: "approved", reason: "Migraine", approved_by: adminId, approved_at: now(-3) },
      { carer_id: thomas!.id, org_id: orgId, absence_type: "sick_leave", start_date: dateStr(0), end_date: dateStr(1), status: "pending", reason: "Feeling unwell" },
    ];
    const { error: abErr } = await supabase.from("absences").insert(absences);
    if (abErr) throw new Error("Absences: " + abErr.message);

    // ── Incidents (4-5) ──────────────────────────────────────────────────
    const incidentTemplates = [
      { severity: "low", category: "fall", title: "Minor slip in bathroom", description: "Client Eleanor slipped in bathroom but was caught by carer before hitting the floor. No injuries sustained." },
      { severity: "medium", category: "medication", title: "Missed medication dose", description: "Morning medication for client George was administered 45 minutes late due to scheduling confusion." },
      { severity: "low", category: "behavioral", title: "Client refused care", description: "Client Margaret refused personal care this morning. Became verbally agitated when carer insisted. Later accepted care from senior carer." },
      { severity: "high", category: "fall", title: "Client found on floor", description: "Client Robert found on floor beside bed at 3am. No visible injuries. Checked by on-call nurse. Increased bed rail monitoring implemented." },
      { severity: "medium", category: "other", title: "Water damage in room 6", description: "Overflowing toilet in client Stanley's bathroom caused water damage to floor. Maintenance called. Client moved to temporary room." },
    ];
    const incInserts = incidentTemplates.map((inc, i) => ({
      org_id: orgId,
      client_id: allClients[i].id,
      carer_id: randomItem(allCarers).id,
      severity: inc.severity,
      category: inc.category,
      title: inc.title,
      description: inc.description,
      action_taken: inc.severity === "high" ? "On-call nurse notified. Incident report filed. Family informed." : "Verbally reported to senior carer. Logged in system.",
      status: i < 2 ? "resolved" : "open",
      reported_at: now(-14 + i * 3),
      resolved_at: i < 2 ? now(-12 + i * 3) : null,
    }));
    const { error: incErr } = await supabase.from("incidents").insert(incInserts);
    if (incErr) throw new Error("Incidents: " + incErr.message);

    // ── Medications (2 per client) ──────────────────────────────────────
    const medList = [
      { drug: "Paracetamol", dosage: "500mg", frequency: "4 times daily", route: "oral" },
      { drug: "Omeprazole", dosage: "20mg", frequency: "Once daily", route: "oral" },
      { drug: "Amlodipine", dosage: "5mg", frequency: "Once daily", route: "oral" },
      { drug: "Metformin", dosage: "500mg", frequency: "Twice daily", route: "oral" },
      { drug: "Salbutamol", dosage: "100mcg", frequency: "As required", route: "inhalation" },
      { drug: "Aspirin", dosage: "75mg", frequency: "Once daily", route: "oral" },
      { drug: "Furosemide", dosage: "40mg", frequency: "Once daily", route: "oral" },
      { drug: "Levothyroxine", dosage: "50mcg", frequency: "Once daily", route: "oral" },
    ];
    const medInserts = allClients.flatMap((client) => {
      const picked = [randomItem(medList), randomItem(medList)];
      return picked.map((m) => ({
        org_id: orgId,
        client_id: client.id,
        drug_name: m.drug,
        dosage: m.dosage,
        frequency: m.frequency,
        route: m.route,
        start_date: dateStr(-180 - Math.floor(Math.random() * 180)),
        prescribed_by: "Dr. Katherine Ellis, Leicester Royal Infirmary",
        notes: Math.random() < 0.3 ? "Take with food" : null,
        status: "active",
      }));
    });
    const { data: medications, error: medErr } = await supabase.from("medications").insert(medInserts).select();
    if (medErr) throw new Error("Medications: " + medErr.message);

    // ── Medication Logs (for completed shifts) ──────────────────────────
    const medLogInserts = completedShifts.slice(0, 30).flatMap((s) => {
      const clientMeds = medications!.filter((m) => m.client_id === s.client_id);
      return clientMeds.slice(0, 1).map((m) => ({
        org_id: orgId,
        medication_id: m.id,
        carer_id: s.carer_id,
        administered_at: new Date(new Date(s.start_time).getTime() + 60 * 60 * 1000).toISOString(),
        status: randomItem(["given", "given", "given", "refused", "missed"]),
        notes: Math.random() < 0.3 ? "Client tolerated well" : null,
      }));
    });
    const { error: mlErr } = await supabase.from("medication_logs").insert(medLogInserts);
    if (mlErr) throw new Error("Med Logs: " + mlErr.message);

    // ── Care Plans (one per client) ─────────────────────────────────────
    const carePlanInserts = allClients.map((client) => ({
      org_id: orgId,
      client_id: client.id,
      title: `Care Plan for ${client.full_name}`,
      goals: "Maintain independence where possible. Ensure safety and dignity. Regular monitoring of health conditions.",
      interventions: "Daily personal care. Medication management. Mobility assistance. Nutritional support. Social engagement activities.",
      notes: client.care_notes,
      status: "active",
      review_date: dateStr(90 - Math.floor(Math.random() * 30)),
      created_by: adminId,
    }));
    const { error: cpErr } = await supabase.from("care_plans").insert(carePlanInserts);
    if (cpErr) throw new Error("Care Plans: " + cpErr.message);

    return NextResponse.json({
      success: true,
      counts: {
        locations: locs!.length,
        document_types: dts!.length,
        clients: allClients.length,
        carers: allCarers.length,
        qualifications: quals.length,
        documents: docInserts.length,
        shifts: shifts!.length,
        tasks: taskInserts.length,
        care_notes: careNoteInserts.length,
        handovers: handoverInserts.slice(0, 30).length,
        absences: absences.length,
        incidents: incInserts.length,
        medications: medInserts.length,
        medication_logs: medLogInserts.length,
        care_plans: carePlanInserts.length,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Seed error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
