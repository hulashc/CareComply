import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";
import { randomUUID } from "crypto";
import { WebSocket } from "ws";

config({ path: resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: WebSocket as unknown as any },
});

async function seed() {
  console.log("Starting demo data seed...\n");

  // ---- Check if data already exists ----
  const { count: existingShifts } = await supabase
    .from("shifts")
    .select("*", { count: "exact", head: true });

  if (existingShifts && existingShifts > 5) {
    console.log("Demo data already exists (found shifts). Skipping seed.\n");
    return;
  }

  // ---- 1. Document Types ----
  const docTypes = [
    { name: "DBS Certificate", is_mandatory: true, applies_to: "carer", renewal_lead_days: 30 },
    { name: "Passport", is_mandatory: true, applies_to: "carer", renewal_lead_days: 60 },
    { name: "Visa / BRP", is_mandatory: false, applies_to: "carer", renewal_lead_days: 60 },
    { name: "Driving Licence", is_mandatory: false, applies_to: "carer", renewal_lead_days: 30 },
    { name: "Proof of Address", is_mandatory: false, applies_to: "carer", renewal_lead_days: 0 },
    { name: "Training Certificate", is_mandatory: false, applies_to: "carer", renewal_lead_days: 30 },
    { name: "Professional Registration", is_mandatory: false, applies_to: "carer", renewal_lead_days: 30 },
  ];

  const { data: docTypeRows } = await supabase
    .from("document_types")
    .insert(docTypes)
    .select("id, name")
    .maybeSingle();

  if (!docTypeRows) {
    // They might already exist — fetch them
    const { data: existing } = await supabase.from("document_types").select("id, name");
    if (existing) {
      // Use existing
      console.log("Document types already exist, reusing.");
    }
  }

  const { data: allDocTypes } = await supabase.from("document_types").select("id, name");
  const dt = (name: string) => allDocTypes?.find((d) => d.name === name)?.id ?? null;

  // ---- 2. Organization ----
  const { data: existingOrg } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("name", "Heritage Healthcare Leicester")
    .maybeSingle();

  let orgId: string;
  if (existingOrg) {
    orgId = existingOrg.id;
    console.log(`Using existing organization: ${existingOrg.name} (${orgId})`);
  } else {
    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .insert({
        name: "Heritage Healthcare Leicester",
        subscription_status: "active",
        seats_purchased: 10,
      })
      .select("id")
      .single();

    if (orgErr) throw new Error(`Failed to create org: ${orgErr.message}`);
    orgId = org!.id;
    console.log(`Created organization: Heritage Healthcare Leicester (${orgId})`);
  }

  // ---- 3. Admin - find existing admin user ----
  const { data: existingAdmins } = await supabase
    .from("admins")
    .select("id, org_id, full_name");

  let adminId: string;

  if (existingAdmins && existingAdmins.length > 0) {
    adminId = existingAdmins[0].id;
    // Update org_id if not set
    if (existingAdmins[0].org_id !== orgId) {
      await supabase.from("admins").update({ org_id: orgId }).eq("id", adminId);
    }
    console.log(`Using existing admin: ${existingAdmins[0].full_name || adminId}`);
  } else {
    console.log("No admin found. Please run the app and sign up first, then re-run seed.");
    return;
  }

  // ---- 4. Carers ----
  const carersData = [
    { full_name: "Sarah Mitchell", role: "carer", email: "sarah@oakfield.example", phone: "07700 900101", start_date: "2024-03-01", status: "active" },
    { full_name: "James Okonkwo", role: "carer", email: "james@oakfield.example", phone: "07700 900102", start_date: "2024-06-15", status: "active" },
    { full_name: "Emma Thompson", role: "carer", email: "emma@oakfield.example", phone: "07700 900103", start_date: "2024-09-01", status: "active" },
    { full_name: "David Chen", role: "carer", email: "david@oakfield.example", phone: "07700 900104", start_date: "2023-11-01", status: "active" },
    { full_name: "Priya Patel", role: "carer", email: "priya@oakfield.example", phone: "07700 900105", start_date: "2025-01-10", status: "active" },
    { full_name: "Robert Wilson", role: "carer", email: "robert@oakfield.example", phone: "07700 900106", start_date: "2024-04-20", status: "active" },
    { full_name: "Lisa O'Brien", role: "carer", email: "lisa@oakfield.example", phone: "07700 900107", start_date: "2025-02-01", status: "active" },
    { full_name: "Mohammed Ali", role: "carer", email: "mohammed@oakfield.example", phone: "07700 900108", start_date: "2024-08-15", status: "active" },
    { full_name: "Charlotte Davies", role: "carer", email: "charlotte@oakfield.example", phone: "07700 900109", start_date: "2023-06-01", status: "active" },
    { full_name: "Thomas Baker", role: "carer", email: "thomas@oakfield.example", phone: "07700 900110", start_date: "2025-03-01", status: "active" },
  ];

  const { data: carerRows, error: carerErr } = await supabase
    .from("carers")
    .insert(
      carersData.map((c) => ({
        ...c,
        org_id: orgId,
        is_available: true,
      }))
    )
    .select("id, full_name");

  if (carerErr) throw new Error(`Failed to create carers: ${carerErr.message}`);
  const carers = carerRows!;
  console.log(`Created ${carers.length} carers`);

  // Function to get random carer
  const randomCarer = () => carers[Math.floor(Math.random() * carers.length)];
  const randomCarers = (n: number) => {
    const shuffled = [...carers].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
  };

  // ---- 5. Clients ----
  const clientsData = [
    { full_name: "Margaret Whitmore", dob: "1942-03-14", address: "12 Rose Cottage Lane, Oakfield, OF1 2AB", emergency_contact_name: "John Whitmore (son)", emergency_contact_phone: "07700 900201", care_notes: "Dementia care. Needs assistance with mobility. Prefers warm drinks." },
    { full_name: "George Hawkins", dob: "1938-07-22", address: "4 Meadow Way, Oakfield, OF1 3CD", emergency_contact_name: "Susan Hawkins (daughter)", emergency_contact_phone: "07700 900202", care_notes: "Diabetes Type 2. Insulin morning and evening. Hard of hearing." },
    { full_name: "Doris Fletcher", dob: "1940-11-30", address: "8 Oak Avenue, Oakfield, OF2 4EF", emergency_contact_name: "Mark Fletcher (nephew)", emergency_contact_phone: "07700 900203", care_notes: "Post-stroke recovery. Requires hoist for transfers. PEG fed." },
    { full_name: "Arthur Pendelton", dob: "1935-05-18", address: "15 Station Road, Oakfield, OF2 5GH", emergency_contact_name: "Claire Pendelton (wife)", emergency_contact_phone: "07700 900204", care_notes: "Parkinson's disease. Needs assistance with all personal care. Falls risk." },
    { full_name: "Iris Chapman", dob: "1944-09-09", address: "3 The Green, Oakfield, OF3 6IJ", emergency_contact_name: "Peter Chapman (son)", emergency_contact_phone: "07700 900205", care_notes: "Arthritis. Uses walking frame. Needs help with medication management." },
    { full_name: "Ronald Bennett", dob: "1939-01-25", address: "22 Church Street, Oakfield, OF3 7KL", emergency_contact_name: "Helen Bennett (daughter)", emergency_contact_phone: "07700 900206", care_notes: "COPD. Requires oxygen therapy. Registered blind." },
    { full_name: "Edna Walsh", dob: "1941-12-03", address: "7 Park View, Oakfield, OF4 8MN", emergency_contact_name: "Kevin Walsh (grandson)", emergency_contact_phone: "07700 900207", care_notes: "Alzheimer's. Wandering risk. Requires 1:1 supervision." },
    { full_name: "Frank Harris", dob: "1936-08-17", address: "19 Hillcrest Road, Oakfield, OF4 9OP", emergency_contact_name: "Anne Harris (wife)", emergency_contact_phone: "07700 900208", care_notes: "Heart condition. Daily medication. Limited mobility, uses wheelchair." },
    { full_name: "Mabel Turner", dob: "1943-04-28", address: "5 Riverside Close, Oakfield, OF5 1QR", emergency_contact_name: "Tom Turner (son)", emergency_contact_phone: "07700 900209", care_notes: "Recently bereaved. Low mood. Encouraging social interaction." },
    { full_name: "Cyril Webb", dob: "1937-10-11", address: "11 Mill Lane, Oakfield, OF5 2ST", emergency_contact_name: "Diana Webb (daughter)", emergency_contact_phone: "07700 900210", care_notes: "Incontinence care. Regular toileting schedule. Pressure area care." },
    { full_name: "Beatrice Ford", dob: "1945-06-19", address: "9 Elm Grove, Oakfield, OF6 3UV", emergency_contact_name: "Sarah Ford (niece)", emergency_contact_phone: "07700 900211", care_notes: "Visual impairment. Needs assistance with meals. Caters for vegetarian diet." },
    { full_name: "Stanley Moore", dob: "1940-02-14", address: "14 Birchwood Drive, Oakfield, OF6 4WX", emergency_contact_name: "Gary Moore (son)", emergency_contact_phone: "07700 900212", care_notes: "Dementia with challenging behaviour. De-escalation techniques required. PRN medication available." },
  ];

  const { data: clientRows, error: clientErr } = await supabase
    .from("clients")
    .insert(clientsData.map((c) => ({ ...c, org_id: orgId })))
    .select("id, full_name");

  if (clientErr) throw new Error(`Failed to create clients: ${clientErr.message}`);
  const clients = clientRows!;
  console.log(`Created ${clients.length} clients`);

  const randomClient = () => clients[Math.floor(Math.random() * clients.length)];

  // ---- 6. Documents ----
  const now = new Date();
  const daysFromNow = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + n);
    return d.toISOString().split("T")[0];
  };

  const documentsData = [
    { owner_id: carers[0].id, document_type_id: dt("DBS Certificate"), expiry_date: daysFromNow(180), status: "green" },
    { owner_id: carers[0].id, document_type_id: dt("Passport"), expiry_date: daysFromNow(365), status: "green" },
    { owner_id: carers[0].id, document_type_id: dt("Training Certificate"), expiry_date: daysFromNow(20), status: "amber" },
    { owner_id: carers[1].id, document_type_id: dt("DBS Certificate"), expiry_date: daysFromNow(-10), status: "red" },
    { owner_id: carers[1].id, document_type_id: dt("Driving Licence"), expiry_date: daysFromNow(90), status: "green" },
    { owner_id: carers[2].id, document_type_id: dt("DBS Certificate"), expiry_date: daysFromNow(250), status: "green" },
    { owner_id: carers[2].id, document_type_id: dt("Passport"), expiry_date: daysFromNow(-5), status: "red" },
    { owner_id: carers[2].id, document_type_id: dt("Proof of Address"), expiry_date: null, status: "green" },
    { owner_id: carers[3].id, document_type_id: dt("DBS Certificate"), expiry_date: daysFromNow(45), status: "amber" },
    { owner_id: carers[3].id, document_type_id: dt("Training Certificate"), expiry_date: daysFromNow(100), status: "green" },
    { owner_id: carers[3].id, document_type_id: dt("Professional Registration"), expiry_date: daysFromNow(15), status: "amber" },
    { owner_id: carers[4].id, document_type_id: dt("DBS Certificate"), expiry_date: daysFromNow(365), status: "green" },
    { owner_id: carers[4].id, document_type_id: dt("Passport"), expiry_date: daysFromNow(730), status: "green" },
    { owner_id: carers[5].id, document_type_id: dt("DBS Certificate"), expiry_date: daysFromNow(-30), status: "red" },
    { owner_id: carers[5].id, document_type_id: dt("Driving Licence"), expiry_date: daysFromNow(-60), status: "red" },
    { owner_id: carers[6].id, document_type_id: dt("DBS Certificate"), expiry_date: daysFromNow(300), status: "green" },
    { owner_id: carers[6].id, document_type_id: dt("Training Certificate"), expiry_date: daysFromNow(25), status: "amber" },
    { owner_id: carers[7].id, document_type_id: dt("DBS Certificate"), expiry_date: daysFromNow(60), status: "amber" },
    { owner_id: carers[7].id, document_type_id: dt("Passport"), expiry_date: daysFromNow(400), status: "green" },
    { owner_id: carers[7].id, document_type_id: dt("Visa / BRP"), expiry_date: daysFromNow(200), status: "green" },
    { owner_id: carers[8].id, document_type_id: dt("DBS Certificate"), expiry_date: daysFromNow(150), status: "green" },
    { owner_id: carers[8].id, document_type_id: dt("Training Certificate"), expiry_date: daysFromNow(5), status: "amber" },
    { owner_id: carers[9].id, document_type_id: dt("DBS Certificate"), expiry_date: daysFromNow(90), status: "green" },
    { owner_id: carers[9].id, document_type_id: dt("Passport"), expiry_date: daysFromNow(550), status: "green" },
  ];

  const { error: docErr } = await supabase.from("documents").insert(
    documentsData.map((d) => ({
      ...d,
      org_id: orgId,
      owner_type: "carer",
    }))
  );

  if (docErr) throw new Error(`Failed to create documents: ${docErr.message}`);
  console.log(`Created ${documentsData.length} documents`);

  // ---- 7. Shifts ----
  const shiftDate = (dayOffset: number, hour: number, minute: number = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };

  const shiftPatterns = [
    { clientOffset: 0, dayOffset: 0, startHour: 7, endHour: 14 },
    { clientOffset: 1, dayOffset: 0, startHour: 14, endHour: 21 },
    { clientOffset: 2, dayOffset: 0, startHour: 21, endHour: 7 },
    { clientOffset: 3, dayOffset: 1, startHour: 7, endHour: 14 },
    { clientOffset: 4, dayOffset: 1, startHour: 14, endHour: 21 },
    { clientOffset: 5, dayOffset: 2, startHour: 7, endHour: 14 },
    { clientOffset: 6, dayOffset: 2, startHour: 14, endHour: 21 },
    { clientOffset: 7, dayOffset: 3, startHour: 7, endHour: 14 },
    { clientOffset: 8, dayOffset: 3, startHour: 14, endHour: 21 },
    { clientOffset: 9, dayOffset: 4, startHour: 7, endHour: 14 },
    { clientOffset: 10, dayOffset: 4, startHour: 14, endHour: 21 },
    { clientOffset: 11, dayOffset: 5, startHour: 7, endHour: 14 },
    { clientOffset: 0, dayOffset: 5, startHour: 14, endHour: 21 },
    { clientOffset: 1, dayOffset: 6, startHour: 7, endHour: 14 },
    { clientOffset: 2, dayOffset: 6, startHour: 14, endHour: 21 },
    { clientOffset: 3, dayOffset: 7, startHour: 7, endHour: 14 },
    { clientOffset: 4, dayOffset: 7, startHour: 14, endHour: 21 },
    { clientOffset: 5, dayOffset: 8, startHour: 7, endHour: 14 },
    { clientOffset: 6, dayOffset: 8, startHour: 14, endHour: 21 },
    { clientOffset: 7, dayOffset: 9, startHour: 7, endHour: 14 },
    { clientOffset: 8, dayOffset: 9, startHour: 14, endHour: 21 },
    { clientOffset: 9, dayOffset: 11, startHour: 7, endHour: 14 },
    { clientOffset: 10, dayOffset: 11, startHour: 14, endHour: 21 },
    { clientOffset: 11, dayOffset: 12, startHour: 7, endHour: 14 },
    { clientOffset: 3, dayOffset: 12, startHour: 14, endHour: 21 },
  ];

  const shiftStatuses = ["scheduled", "scheduled", "scheduled", "scheduled", "completed"];

  const shiftInserts = shiftPatterns.map((s, i) => {
    const clientIdx = s.clientOffset % clients.length;
    const carerIdx = i % carers.length;
    const isNightShift = s.startHour === 21;
    return {
      client_id: clients[clientIdx].id,
      carer_id: carers[carerIdx].id,
      org_id: orgId,
      start_time: shiftDate(s.dayOffset, s.startHour),
      end_time: shiftDate(isNightShift ? s.dayOffset + 1 : s.dayOffset, s.endHour),
      status: i < 5 ? "completed" : "scheduled",
      notes: isNightShift ? "Night shift: check all residents before bed" : null,
      recurrence_type: "none",
    };
  });

  const { error: shiftErr } = await supabase.from("shifts").insert(shiftInserts);
  if (shiftErr) throw new Error(`Failed to create shifts: ${shiftErr.message}`);
  console.log(`Created ${shiftInserts.length} shifts`);

  // ---- 8. Incidents ----
  const incidentsData = [
    { client_id: clients[6].id, carer_id: carers[2].id, severity: "high", category: "fall", title: "Edna found on floor beside bed", description: "Edna was found on the floor beside her bed at 03:15. No visible injuries. Hoisted back to bed. Observations taken. Family informed.", status: "open", action_taken: "Hoisted to bed. Obs every 15min for 2hrs. GP notified." },
    { client_id: clients[5].id, carer_id: carers[4].id, severity: "medium", category: "medication", title: "Ronald missed morning insulin", description: "Ronald did not receive his morning insulin dose. Discovered at lunchtime when checking MAR. Dose given late. GP informed.", status: "open", action_taken: "Late dose administered. GP informed. Incident form completed." },
    { client_id: clients[1].id, carer_id: carers[6].id, severity: "low", category: "behavioural", title: "George agitated with new carer", description: "George became verbally agitated when new carer attempted to assist with personal care. Settled after familiar carer took over. No physical harm.", status: "resolved", action_taken: "Familiar carer reassigned. Note in care plan. Will re-introduce new carer gradually." },
    { client_id: clients[9].id, carer_id: carers[1].id, severity: "medium", category: "skin_injury", title: "Cyril developed pressure sore", description: "Grade 2 pressure sore observed on sacrum during morning care. New pressure-relieving mattress ordered. Repositioning schedule every 2hrs.", status: "resolved", action_taken: "Pressure mattress ordered. Repositioning chart started. Tissue Viability Nurse referral sent." },
    { client_id: clients[3].id, carer_id: carers[8].id, severity: "high", category: "fall", title: "Arthur fell in bathroom", description: "Arthur slipped getting out of shower. Landed on hip. X-ray confirmed no fracture. Bruising to right hip and elbow.", status: "resolved", action_taken: "Occupational Therapy referral for shower chair. Non-slip mat installed. Mobility assessment updated." },
    { client_id: clients[7].id, carer_id: carers[3].id, severity: "low", category: "other", title: "Frank's oxygen tubing tangled", description: "Frank's oxygen tubing became tangled around his wheelchair wheel. Quickly resolved. No distress caused. Tubing now clipped to frame.", status: "open", action_taken: "Oxygen tubing clipped to wheelchair frame. Staff reminded to check tubing before transfers." },
  ];

  const { error: incErr } = await supabase.from("incidents").insert(
    incidentsData.map((inc) => ({
      ...inc,
      org_id: orgId,
      reported_at: new Date(now.getTime() - Math.random() * 14 * 86400000).toISOString(),
      created_at: new Date(now.getTime() - Math.random() * 14 * 86400000).toISOString(),
      resolved_at: inc.status === "resolved" ? new Date(now.getTime() - Math.random() * 5 * 86400000).toISOString() : null,
    }))
  );

  if (incErr) throw new Error(`Failed to create incidents: ${incErr.message}`);
  console.log(`Created ${incidentsData.length} incidents`);

  // ---- 9. Handover Notes ----
  const handoverData = [
    { client_id: clients[0].id, from_carer_id: carers[0].id, to_carer_id: carers[1].id, mood: "happy", note_text: "Margaret had a good day. She enjoyed a visit from her son and ate all her meals. Mobility was steady with her walking frame.", concerns: null, tasks_completed: "Personal care, meals, medication given", tasks_remaining: "Evening snack, night-time medication" },
    { client_id: clients[1].id, from_carer_id: carers[2].id, to_carer_id: carers[3].id, mood: "neutral", note_text: "George's blood sugar was slightly high this morning (12.4). Insulin adjusted as per GP plan. He was less engaged than usual.", concerns: "Blood sugar levels need monitoring. Possible UTI developing?", tasks_completed: "Insulin, breakfast assistance, shower", tasks_remaining: "Evening insulin, supper" },
    { client_id: clients[2].id, from_carer_id: carers[4].id, to_carer_id: carers[5].id, mood: "distressed", note_text: "Doris had a difficult afternoon. She was agitated and tried to remove her PEG tube twice. Doctor visited and prescribed midazolam PRN.", concerns: "PEG site looks slightly red. District nurse visiting tomorrow.", tasks_completed: "PEG feed, personal care, repositioning", tasks_remaining: "PRN if needed, monitor PEG site" },
    { client_id: clients[4].id, from_carer_id: carers[6].id, to_carer_id: carers[7].id, mood: "happy", note_text: "Iris went to the garden with activities team. She enjoyed potting plants. Good appetite at lunch.", concerns: null, tasks_completed: "Medication, personal care, activities", tasks_remaining: "Evening care, night medication" },
    { client_id: clients[8].id, from_carer_id: carers[8].id, to_carer_id: carers[9].id, mood: "concerned", note_text: "Mabel was tearful this evening. Missing her husband. Stayed with her for 30 minutes and she settled. Bereavement counselling referral being made.", concerns: "Low mood. Encourage social activities. Monitor eating.", tasks_completed: "Personal care, meals, emotional support", tasks_remaining: "Night-time check. Ensure safe" },
  ];

  const { error: handErr } = await supabase.from("handover_notes").insert(
    handoverData.map((h) => ({
      ...h,
      org_id: orgId,
      created_at: new Date(now.getTime() - Math.random() * 3 * 86400000).toISOString(),
    }))
  );

  if (handErr) throw new Error(`Failed to create handover notes: ${handErr.message}`);
  console.log(`Created ${handoverData.length} handover notes`);

  // ---- 10. Care Plans ----
  const carePlanTemplates = [
    { title: "Personal Care Plan", goals: "Maintain dignity and independence with personal care tasks", interventions: "Assist with washing, dressing, and toileting as required. Encourage self-care where possible." },
    { title: "Mobility & Falls Prevention", goals: "Reduce falls risk and maintain safe mobility", interventions: "Use walking aid at all times. Non-slip footwear. Clear pathways. Bed rails at night." },
    { title: "Nutrition & Hydration", goals: "Maintain healthy weight and adequate hydration", interventions: "Monitor food and fluid intake. Provide fortified meals. Offer drinks hourly. Weigh weekly." },
    { title: "Medication Management", goals: "Ensure medications are administered correctly and on time", interventions: "MAR chart completed each administration. Review with GP quarterly. Observe for side effects." },
    { title: "Social Engagement", goals: "Reduce isolation and promote wellbeing", interventions: "Encourage group activities. Family visits welcomed. Daily social interaction recorded." },
    { title: "Pressure Area Care", goals: "Maintain skin integrity and prevent pressure sores", interventions: "Reposition every 2 hours. Use pressure-relieving equipment. Daily skin inspection." },
  ];

  const carePlanInserts = clients.flatMap((client) => {
    const numPlans = Math.floor(Math.random() * 3) + 2;
    const shuffled = [...carePlanTemplates].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, numPlans).map((plan) => ({
      client_id: client.id,
      org_id: orgId,
      title: plan.title,
      goals: plan.goals,
      interventions: plan.interventions,
      status: "active",
      created_by: adminId,
      review_date: daysFromNow(Math.floor(Math.random() * 90) + 30),
    }));
  });

  const { error: cpErr } = await supabase.from("care_plans").insert(carePlanInserts);
  if (cpErr) throw new Error(`Failed to create care plans: ${cpErr.message}`);
  console.log(`Created ${carePlanInserts.length} care plans`);

  // ---- 11. Medications ----
  const medData = [
    { drug_name: "Omeprazole 20mg", dosage: "20mg once daily", frequency: "Once daily", route: "oral" },
    { drug_name: "Paracetamol 500mg", dosage: "500mg four times daily", frequency: "QDS", route: "oral" },
    { drug_name: "Atorvastatin 40mg", dosage: "40mg at night", frequency: "Once daily", route: "oral" },
    { drug_name: "Amlodipine 5mg", dosage: "5mg once daily", frequency: "Once daily", route: "oral" },
    { drug_name: "Bisacodyl 5mg", dosage: "5mg PRN", frequency: "As required", route: "oral" },
    { drug_name: "Lansoprazole 15mg", dosage: "15mg once daily", frequency: "Once daily", route: "oral" },
    { drug_name: "Furosemide 40mg", dosage: "40mg once daily", frequency: "Once daily", route: "oral" },
    { drug_name: "Salbutamol Inhaler", dosage: "2 puffs as required", frequency: "PRN", route: "inhaled" },
    { drug_name: "Donepezil 5mg", dosage: "5mg at bedtime", frequency: "Once daily", route: "oral" },
    { drug_name: "Mirtazapine 15mg", dosage: "15mg at night", frequency: "Once daily", route: "oral" },
    { drug_name: "Insulin Novorapid", dosage: "Variable scale", frequency: "With meals", route: "subcutaneous" },
    { drug_name: "Co-codamol 30/500", dosage: "2 tablets QDS PRN", frequency: "As required", route: "oral" },
  ];

  const medInserts = clients.flatMap((client) => {
    const numMeds = Math.floor(Math.random() * 3) + 1;
    const shuffled = [...medData].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, numMeds).map((med) => ({
      client_id: client.id,
      org_id: orgId,
      drug_name: med.drug_name,
      dosage: med.dosage,
      frequency: med.frequency,
      route: med.route,
      start_date: daysFromNow(-Math.floor(Math.random() * 180) - 30),
      status: "active",
    }));
  });

  const { data: medRows, error: medErr } = await supabase.from("medications").insert(medInserts).select("id, client_id");
  if (medErr) throw new Error(`Failed to create medications: ${medErr.message}`);
  const meds = medRows!;
  console.log(`Created ${medInserts.length} medications`);

  // ---- 12. Medication Logs ----
  const medLogInserts = meds.slice(0, 20).map((med) => {
    const carer = randomCarer();
    const hoursAgo = Math.floor(Math.random() * 72);
    return {
      medication_id: med.id,
      carer_id: carer.id,
      org_id: orgId,
      status: Math.random() > 0.15 ? "given" : "refused",
      administered_at: new Date(now.getTime() - hoursAgo * 3600000).toISOString(),
      notes: Math.random() > 0.7 ? "Patient reluctant but took medication with encouragement" : null,
    };
  });

  const { error: mlErr } = await supabase.from("medication_logs").insert(medLogInserts);
  if (mlErr) throw new Error(`Failed to create medication logs: ${mlErr.message}`);
  console.log(`Created ${medLogInserts.length} medication logs`);

  // ---- 13. Care Notes ----
  const careNoteTemplates = [
    { note_type: "observation", note_text: "Client in good spirits today. Engaged well with carers. Appetite good.", mood: "happy", fluids: "1.5L", nutrition: "Full meals" },
    { note_type: "observation", note_text: "Slept well through the night. Only woke once for bathroom assistance.", mood: "neutral", fluids: null, nutrition: null },
    { note_type: "observation", note_text: "Complained of mild discomfort in lower back. Given PRN analgesia. Reassessed after 1 hour - improved.", mood: "concerned", fluids: "1L", nutrition: "Partial meal" },
    { note_type: "observation", note_text: "Spent time in communal lounge watching television. Interacted with other residents during afternoon tea.", mood: "happy", fluids: "2L", nutrition: "All meals eaten" },
    { note_type: "observation", note_text: "Quiet day. Preferred to stay in room. Staff checked hourly. Accepted hot drinks and snacks.", mood: "neutral", fluids: "1.2L", nutrition: "Light meals" },
    { note_type: "observation", note_text: "Physiotherapy session this morning. Good participation. Walking slightly improved.", mood: "happy", fluids: null, nutrition: "Full meals" },
  ];

  const careNoteInserts = clients.slice(0, 8).flatMap((client) => {
    const numNotes = Math.floor(Math.random() * 3) + 2;
    const shuffled = [...careNoteTemplates].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, numNotes).map((note) => ({
      client_id: client.id,
      carer_id: randomCarer().id,
      org_id: orgId,
      note_type: note.note_type,
      note_text: note.note_text,
      mood: note.mood,
      fluids: note.fluids ?? null,
      nutrition: note.nutrition ?? null,
      created_at: new Date(now.getTime() - Math.floor(Math.random() * 7) * 86400000).toISOString(),
    }));
  });

  const { error: cnErr } = await supabase.from("care_notes").insert(careNoteInserts);
  if (cnErr) throw new Error(`Failed to create care notes: ${cnErr.message}`);
  console.log(`Created ${careNoteInserts.length} care notes`);

  // ---- 14. Tasks ----
  const taskData = [
    { client_id: clients[0].id, carer_id: carers[0].id, title: "Order Margaret's new walking frame", category: "equipment", priority: "medium", status: "pending", due_date: daysFromNow(3) },
    { client_id: clients[1].id, carer_id: carers[2].id, title: "Book George's diabetic eye screening", category: "appointment", priority: "high", status: "pending", due_date: daysFromNow(7) },
    { client_id: clients[2].id, carer_id: carers[5].id, title: "Order PEG feeding supplies", category: "equipment", priority: "high", status: "pending", due_date: daysFromNow(2) },
    { client_id: clients[4].id, carer_id: carers[6].id, title: "Arrange GP visit for Iris medication review", category: "appointment", priority: "medium", status: "completed", due_date: daysFromNow(-2) },
    { client_id: clients[6].id, carer_id: carers[2].id, title: "Update Edna's care plan after fall incident", category: "documentation", priority: "high", status: "pending", due_date: daysFromNow(1) },
    { client_id: clients[8].id, carer_id: carers[8].id, title: "Refer Mabel to bereavement counselling", category: "referral", priority: "medium", status: "pending", due_date: daysFromNow(5) },
    { client_id: clients[9].id, carer_id: carers[1].id, title: "Check Cyril's pressure mattress delivery", category: "equipment", priority: "medium", status: "completed", due_date: daysFromNow(-1) },
    { client_id: clients[3].id, carer_id: carers[9].id, title: "Occupational therapy referral for Arthur", category: "referral", priority: "high", status: "pending", due_date: daysFromNow(4) },
  ];

  const { error: taskErr } = await supabase.from("tasks").insert(
    taskData.map((t) => ({
      ...t,
      org_id: orgId,
      completed_at: t.status === "completed" ? new Date(now.getTime() - Math.random() * 5 * 86400000).toISOString() : null,
    }))
  );

  if (taskErr) throw new Error(`Failed to create tasks: ${taskErr.message}`);
  console.log(`Created ${taskData.length} tasks`);

  // ---- 15. Assessments ----
  const assessmentCategories = ["initial", "moving_handling", "pressure_risk", "nutritional", "falls_risk", "mental_capacity"];

  const assessmentInserts = clients.flatMap((client) => {
    const numAssessments = Math.floor(Math.random() * 2) + 1;
    const shuffled = [...assessmentCategories].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, numAssessments).map((cat) => {
      const score = Math.floor(Math.random() * 30) + 1;
      return {
        client_id: client.id,
        org_id: orgId,
        title: `${cat.replace("_", " ")} Assessment`,
        category: cat,
        scores: { score, maxScore: 30, risk: score > 20 ? "high" : score > 10 ? "medium" : "low" },
        status: "completed",
        assessed_by: adminId,
        assessed_at: new Date(now.getTime() - Math.floor(Math.random() * 90) * 86400000).toISOString(),
        next_review_date: daysFromNow(Math.floor(Math.random() * 90) + 30),
        notes: null,
      };
    });
  });

  const { error: assErr } = await supabase.from("assessments").insert(assessmentInserts);
  if (assErr) throw new Error(`Failed to create assessments: ${assErr.message}`);
  console.log(`Created ${assessmentInserts.length} assessments`);

  // ---- 16. Absences ----
  const absencesData = [
    { carer_id: carers[5].id, absence_type: "sick_leave", start_date: daysFromNow(-3), end_date: daysFromNow(-1), status: "approved", approved_by: adminId, reason: "Flu symptoms" },
    { carer_id: carers[2].id, absence_type: "holiday", start_date: daysFromNow(14), end_date: daysFromNow(21), status: "pending", reason: "Annual leave - family wedding" },
    { carer_id: carers[9].id, absence_type: "training", start_date: daysFromNow(5), end_date: daysFromNow(5), status: "pending", reason: "Mandatory manual handling refresher" },
  ];

  const { error: absErr } = await supabase.from("absences").insert(
    absencesData.map((a) => ({
      ...a,
      org_id: orgId,
      approved_at: a.status === "approved" ? new Date(now.getTime() - 4 * 86400000).toISOString() : null,
    }))
  );

  if (absErr) throw new Error(`Failed to create absences: ${absErr.message}`);
  console.log(`Created ${absencesData.length} absences`);

  // ---- 17. Audit Logs ----
  const auditActions = [
    { action: "carer_created", entity_type: "carer", details: "Added carer via onboarding" },
    { action: "client_created", entity_type: "client", details: "New client record created" },
    { action: "shift_created", entity_type: "shift", details: "Shift scheduled" },
    { action: "incident_reported", entity_type: "incident", details: "Incident logged" },
    { action: "incident_resolved", entity_type: "incident", details: "Incident marked as resolved" },
    { action: "document_uploaded", entity_type: "document", details: "Compliance document uploaded" },
    { action: "handover_note_created", entity_type: "handover", details: "Shift handover note written" },
    { action: "medication_administered", entity_type: "medication", details: "Medication logged as given" },
    { action: "application_approved", entity_type: "application", details: "Carer application approved" },
    { action: "care_plan_updated", entity_type: "care_plan", details: "Care plan reviewed and updated" },
  ];

  const auditLogsInserts = auditActions.map((a) => ({
    action: a.action,
    entity_type: a.entity_type,
    entity_id: randomUUID(),
    actor_id: adminId,
    org_id: orgId,
    details: a.details,
    created_at: new Date(now.getTime() - Math.floor(Math.random() * 14) * 86400000).toISOString(),
  }));

  const { error: auditErr } = await supabase.from("audit_logs").insert(auditLogsInserts);
  if (auditErr) throw new Error(`Failed to create audit logs: ${auditErr.message}`);
  console.log(`Created ${auditLogsInserts.length} audit logs`);

  // ---- 18. Qualifications ----
  const qualsData = [
    { carer_id: carers[0].id, qualification_type: "NVQ Level 3 Health and Social Care", status: "valid", issued_date: "2023-03-15", expiry_date: null },
    { carer_id: carers[3].id, qualification_type: "NVQ Level 4 Adult Care", status: "valid", issued_date: "2022-08-01", expiry_date: null },
    { carer_id: carers[1].id, qualification_type: "Care Certificate", status: "valid", issued_date: "2024-07-01", expiry_date: null },
    { carer_id: carers[8].id, qualification_type: "NVQ Level 3 Health and Social Care", status: "valid", issued_date: "2023-11-20", expiry_date: null },
    { carer_id: carers[4].id, qualification_type: "Medication Administration", status: "valid", issued_date: "2025-01-15", expiry_date: daysFromNow(330) },
    { carer_id: carers[5].id, qualification_type: "Care Certificate", status: "valid", issued_date: "2024-05-10", expiry_date: null },
    { carer_id: carers[7].id, qualification_type: "Dementia Awareness", status: "valid", issued_date: "2024-09-01", expiry_date: daysFromNow(60) },
    { carer_id: carers[9].id, qualification_type: "Moving and Handling", status: "valid", issued_date: "2025-02-01", expiry_date: daysFromNow(180) },
    { carer_id: carers[6].id, qualification_type: "Care Certificate", status: "valid", issued_date: "2025-02-15", expiry_date: null },
    { carer_id: carers[2].id, qualification_type: "End of Life Care", status: "valid", issued_date: "2024-10-01", expiry_date: null },
  ];

  const { error: qualErr } = await supabase.from("qualifications").insert(
    qualsData.map((q) => ({ ...q, org_id: orgId }))
  );

  if (qualErr) throw new Error(`Failed to create qualifications: ${qualErr.message}`);
  console.log(`Created ${qualsData.length} qualifications`);

  console.log("\n✅ Demo data seeding complete!");
  console.log(`Organization: Heritage Healthcare Leicester (${orgId})`);
  console.log(`${carers.length} carers, ${clients.length} clients`);
  console.log(`Open the app and sign in to see demo data.`);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
