// Static demo data for scripts/seed-roster.ts: 15 carers and 25 clients around Leicester.
// All people are fictional; phone numbers are in Ofcom's reserved drama range (07700 900xxx) and
// emails use the reserved .test domain.

export const DEMO_TAG = "[roster-demo]";

export const SKILLS: { code: string; name: string }[] = [
  { code: "personal_care", name: "Personal care" },
  { code: "medication_admin", name: "Medication administration" },
  { code: "dementia_care", name: "Dementia care" },
  { code: "hoist_transfers", name: "Hoist and transfers" },
  { code: "peg_feeding", name: "PEG feeding" },
  { code: "catheter_care", name: "Catheter care" },
  { code: "diabetes_care", name: "Diabetes care" },
  { code: "wound_care", name: "Wound care" },
  { code: "end_of_life", name: "End-of-life care" },
  { code: "mental_health", name: "Mental health support" },
];

export type Area = "aylestone" | "clarendon" | "evington" | "belgrave" | "highfields" | "knighton" | "braunstone" | "humberstone" | "western" | "oadby" | "wigston";

export const AREAS: Record<Area, { lat: number; lng: number; postcode: string; label: string }> = {
  aylestone: { lat: 52.61, lng: -1.15, postcode: "LE2 8", label: "Aylestone" },
  clarendon: { lat: 52.625, lng: -1.11, postcode: "LE2 3", label: "Clarendon Park" },
  evington: { lat: 52.628, lng: -1.07, postcode: "LE5 6", label: "Evington" },
  belgrave: { lat: 52.66, lng: -1.13, postcode: "LE4 5", label: "Belgrave" },
  highfields: { lat: 52.633, lng: -1.12, postcode: "LE2 0", label: "Highfields" },
  knighton: { lat: 52.613, lng: -1.11, postcode: "LE2 3", label: "Knighton" },
  braunstone: { lat: 52.627, lng: -1.19, postcode: "LE3 1", label: "Braunstone" },
  humberstone: { lat: 52.649, lng: -1.08, postcode: "LE5 1", label: "Humberstone" },
  western: { lat: 52.633, lng: -1.165, postcode: "LE3 0", label: "Western Park" },
  oadby: { lat: 52.597, lng: -1.08, postcode: "LE2 5", label: "Oadby" },
  wigston: { lat: 52.585, lng: -1.1, postcode: "LE18 2", label: "Wigston" },
};

type Window = [string, string];
/** Working-hours pattern: ISO weekday (1 = Mon) -> windows, London time. */
export type Pattern = Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7, Window[]>>;

const EARLY: Window = ["06:30", "15:00"];
const LATE: Window = ["14:00", "22:30"];
const DAY: Window = ["08:00", "17:00"];
const SPLIT: Window[] = [["07:00", "10:30"], ["16:30", "21:30"]];
export const PATTERNS: Record<string, Pattern> = {
  earlyWeek: { 1: [EARLY], 2: [EARLY], 3: [EARLY], 4: [EARLY], 5: [EARLY], 6: [EARLY] },
  lateWeek: { 1: [LATE], 2: [LATE], 3: [LATE], 4: [LATE], 5: [LATE], 7: [LATE] },
  fullWeek: { 1: [["07:00", "21:30"]], 2: [["07:00", "21:30"]], 3: [["07:00", "21:30"]], 4: [["07:00", "21:30"]], 5: [["07:00", "21:30"]], 6: [["07:00", "21:30"]], 7: [["07:00", "21:30"]] },
  split: { 1: SPLIT, 2: SPLIT, 3: SPLIT, 4: SPLIT, 5: SPLIT, 6: SPLIT, 7: SPLIT },
  partTime: { 2: [DAY], 3: [DAY], 4: [DAY], 6: [["08:00", "16:00"]] },
};

export interface DemoCarer {
  key: string;
  name: string;
  gender: "Female" | "Male";
  role: "carer" | "senior_carer";
  area: Area;
  skills: string[];
  languages: string[];
  transport: "car" | "public_transport" | "bicycle" | "walking";
  maxWeeklyHours: number;
  pattern: keyof typeof PATTERNS;
  smoker?: boolean;
  petAllergies?: string[];
  note: string;
}

export const CARERS: DemoCarer[] = [
  { key: "sarah", name: "Sarah Mitchell", gender: "Female", role: "senior_carer", area: "aylestone", skills: ["dementia_care", "medication_admin", "personal_care", "end_of_life"], languages: ["English"], transport: "car", maxWeeklyHours: 40, pattern: "fullWeek", note: "Team lead; dementia specialist." },
  { key: "james", name: "James O'Brien", gender: "Male", role: "carer", area: "clarendon", skills: ["hoist_transfers", "personal_care", "medication_admin"], languages: ["English"], transport: "car", maxWeeklyHours: 40, pattern: "earlyWeek", note: "Full-time; strong on moving and handling." },
  { key: "priya", name: "Priya Patel", gender: "Female", role: "carer", area: "evington", skills: ["medication_admin", "personal_care", "diabetes_care"], languages: ["English", "Gujarati", "Hindi"], transport: "public_transport", maxWeeklyHours: 25, pattern: "partTime", note: "Part-time; studying nursing." },
  { key: "david", name: "David Thompson", gender: "Male", role: "carer", area: "belgrave", skills: ["end_of_life", "hoist_transfers", "personal_care", "catheter_care"], languages: ["English"], transport: "car", maxWeeklyHours: 40, pattern: "fullWeek", note: "Experienced in end-of-life care." },
  { key: "emily", name: "Emily Watson", gender: "Female", role: "carer", area: "highfields", skills: ["medication_admin", "diabetes_care", "wound_care", "personal_care"], languages: ["English"], transport: "bicycle", maxWeeklyHours: 30, pattern: "earlyWeek", note: "Mornings; excellent medication practice." },
  { key: "mohammed", name: "Mohammed Ali", gender: "Male", role: "carer", area: "highfields", skills: ["personal_care", "hoist_transfers", "dementia_care"], languages: ["English", "Urdu", "Punjabi"], transport: "car", maxWeeklyHours: 40, pattern: "lateWeek", note: "Late shifts; speaks Urdu and Punjabi." },
  { key: "lucy", name: "Lucy Chen", gender: "Female", role: "carer", area: "knighton", skills: ["personal_care", "peg_feeding", "medication_admin", "catheter_care"], languages: ["English", "Mandarin"], transport: "public_transport", maxWeeklyHours: 35, pattern: "split", note: "PEG feeding trained." },
  { key: "thomas", name: "Thomas Clarke", gender: "Male", role: "carer", area: "braunstone", skills: ["personal_care", "mental_health", "medication_admin"], languages: ["English"], transport: "car", maxWeeklyHours: 24, pattern: "lateWeek", smoker: true, note: "Also works as a support worker." },
  { key: "rebecca", name: "Rebecca Jones", gender: "Female", role: "carer", area: "western", skills: ["dementia_care", "personal_care", "wound_care", "medication_admin"], languages: ["English", "Welsh"], transport: "car", maxWeeklyHours: 36, pattern: "fullWeek", petAllergies: ["cat"], note: "Flexible; Welsh speaker; allergic to cats." },
  { key: "daniel", name: "Daniel Williams", gender: "Male", role: "senior_carer", area: "oadby", skills: ["hoist_transfers", "peg_feeding", "end_of_life", "medication_admin", "personal_care"], languages: ["English"], transport: "car", maxWeeklyHours: 40, pattern: "earlyWeek", note: "Senior; advanced first aid." },
  { key: "aisha", name: "Aisha Khan", gender: "Female", role: "carer", area: "belgrave", skills: ["personal_care", "dementia_care", "medication_admin"], languages: ["English", "Urdu"], transport: "public_transport", maxWeeklyHours: 30, pattern: "split", note: "Split shifts around school hours." },
  { key: "grace", name: "Grace Okafor", gender: "Female", role: "carer", area: "wigston", skills: ["personal_care", "diabetes_care", "hoist_transfers", "wound_care"], languages: ["English", "Igbo"], transport: "car", maxWeeklyHours: 40, pattern: "fullWeek", note: "Diabetes and wound care." },
  { key: "kamal", name: "Kamal Singh", gender: "Male", role: "carer", area: "humberstone", skills: ["personal_care", "medication_admin", "mental_health"], languages: ["English", "Punjabi", "Hindi"], transport: "car", maxWeeklyHours: 32, pattern: "lateWeek", smoker: true, note: "Mental health support." },
  { key: "hannah", name: "Hannah Evans", gender: "Female", role: "carer", area: "clarendon", skills: ["personal_care", "catheter_care", "medication_admin", "end_of_life"], languages: ["English"], transport: "walking", maxWeeklyHours: 20, pattern: "partTime", note: "Part-time; walks to local clients." },
  { key: "tomasz", name: "Tomasz Kowalski", gender: "Male", role: "carer", area: "aylestone", skills: ["personal_care", "hoist_transfers", "medication_admin"], languages: ["English", "Polish"], transport: "car", maxWeeklyHours: 40, pattern: "earlyWeek", note: "Polish speaker." },
];

export type CallKind = "morning" | "lunch" | "tea" | "bed" | "social";

export interface DemoClient {
  key: string;
  name: string;
  gender: "Female" | "Male";
  area: Area;
  language: string;
  /** Skills every call needs. */
  skills: string[];
  /** Which calls this client has. */
  calls: CallKind[];
  /** Calls that need two carers (hoist double-ups). */
  doubleUp?: CallKind[];
  /** Double-up calls left half-staffed on purpose. */
  halfStaffed?: CallKind[];
  genderPref?: "female" | "male";
  genderRequired?: boolean;
  nonSmoker?: boolean;
  pets?: string[];
  allergies?: string[];
  preferred?: string[];
  excluded?: { key: string; reason: string }[];
  mobility?: string;
  note: string;
}

export const CLIENTS: DemoClient[] = [
  { key: "eleanor", name: "Eleanor Whitmore", gender: "Female", area: "aylestone", language: "English", skills: ["dementia_care"], calls: ["morning", "tea"], genderPref: "female", preferred: ["sarah", "rebecca"], note: "Dementia; settles best with familiar faces." },
  { key: "george", name: "George Harrison", gender: "Male", area: "clarendon", language: "English", skills: ["personal_care"], calls: ["morning"], genderPref: "male", mobility: "walking_aid", note: "Uses a walking frame." },
  { key: "margaret", name: "Margaret Thornton", gender: "Female", area: "knighton", language: "English", skills: ["personal_care", "medication_admin"], calls: ["morning", "bed"], genderPref: "female", genderRequired: true, note: "Post hip replacement. Female carer only." },
  { key: "robert", name: "Robert Browning", gender: "Male", area: "belgrave", language: "English", skills: ["end_of_life", "personal_care"], calls: ["morning", "lunch", "tea", "bed"], preferred: ["david"], mobility: "bed_bound", note: "End-of-life care; family visit Sundays." },
  { key: "patricia", name: "Patricia Langford", gender: "Female", area: "highfields", language: "English", skills: ["medication_admin", "personal_care"], calls: ["morning", "tea"], nonSmoker: true, pets: ["dog"], note: "Parkinson's; time-critical medication." },
  { key: "arthur", name: "Arthur Pendleton", gender: "Male", area: "oadby", language: "English", skills: ["diabetes_care", "medication_admin"], calls: ["lunch", "tea"], allergies: ["penicillin"], excluded: [{ key: "thomas", reason: "Raised a concern about timekeeping" }], note: "Type 2 diabetes; insulin with meals." },
  { key: "dorothy", name: "Dorothy Green", gender: "Female", area: "wigston", language: "English", skills: ["personal_care"], calls: ["morning", "tea"], preferred: ["grace"], mobility: "wheelchair", note: "Stroke recovery; left-sided weakness." },
  { key: "stanley", name: "Stanley Hudson", gender: "Male", area: "braunstone", language: "English", skills: ["medication_admin"], calls: ["morning", "bed"], nonSmoker: true, pets: ["cat"], note: "COPD; oxygen in the home." },
  { key: "hansa", name: "Hansa Desai", gender: "Female", area: "evington", language: "Gujarati", skills: ["personal_care"], calls: ["morning"], preferred: ["priya"], note: "Prefers a Gujarati speaker." },
  { key: "mohan", name: "Mohan Patel", gender: "Male", area: "evington", language: "Gujarati", skills: ["personal_care", "diabetes_care"], calls: ["morning", "tea"], preferred: ["priya"], note: "Diabetic; Gujarati speaker." },
  { key: "zofia", name: "Zofia Nowak", gender: "Female", area: "aylestone", language: "Polish", skills: ["personal_care"], calls: ["lunch", "tea"], preferred: ["tomasz"], note: "Limited English; Polish speaker preferred." },
  { key: "iqbal", name: "Iqbal Hussain", gender: "Male", area: "belgrave", language: "Urdu", skills: ["dementia_care", "personal_care"], calls: ["morning", "bed"], preferred: ["mohammed", "aisha"], note: "Dementia; responds to Urdu." },
  { key: "gwen", name: "Gwen Davies", gender: "Female", area: "western", language: "English", skills: ["dementia_care"], calls: ["morning"], preferred: ["rebecca"], note: "Welsh speaker; enjoys chatting in Welsh." },
  { key: "walter", name: "Walter Bennett", gender: "Male", area: "knighton", language: "English", skills: ["peg_feeding", "personal_care"], calls: ["lunch", "tea", "bed"], preferred: ["lucy"], note: "PEG fed; needs trained carers only." },
  { key: "joan", name: "Joan Fletcher", gender: "Female", area: "highfields", language: "English", skills: ["wound_care", "personal_care"], calls: ["morning"], note: "Leg ulcer dressing every visit." },
  { key: "leonard", name: "Leonard Cross", gender: "Male", area: "clarendon", language: "English", skills: ["hoist_transfers", "personal_care"], calls: ["morning", "lunch", "tea", "bed"], doubleUp: ["morning", "bed"], mobility: "hoist", note: "Hoist transfers: two carers for morning and bedtime." },
  { key: "maureen", name: "Maureen Doyle", gender: "Female", area: "humberstone", language: "English", skills: ["hoist_transfers", "personal_care"], calls: ["morning", "tea"], doubleUp: ["tea"], halfStaffed: ["tea"], mobility: "hoist", note: "Hoist at teatime needs two carers." },
  { key: "frank", name: "Frank Moore", gender: "Male", area: "braunstone", language: "English", skills: ["mental_health"], calls: ["social"], note: "Social support visits, Tue/Thu/Sat." },
  { key: "sheila", name: "Sheila Barnes", gender: "Female", area: "humberstone", language: "English", skills: ["personal_care"], calls: ["tea"], excluded: [{ key: "kamal", reason: "Client asked not to be visited by this carer" }], note: "" },
  { key: "harold", name: "Harold Price", gender: "Male", area: "knighton", language: "English", skills: ["personal_care", "medication_admin"], calls: ["morning", "bed"], pets: ["dog"], note: "Has a friendly Labrador." },
  { key: "nora", name: "Nora Kelly", gender: "Female", area: "oadby", language: "English", skills: ["catheter_care", "personal_care"], calls: ["morning", "bed"], note: "Catheter care at each call." },
  { key: "cyril", name: "Cyril Ashworth", gender: "Male", area: "wigston", language: "English", skills: ["end_of_life", "personal_care"], calls: ["morning", "tea"], genderPref: "male", genderRequired: true, note: "Male carer only." },
  { key: "edith", name: "Edith Marsh", gender: "Female", area: "western", language: "English", skills: ["dementia_care", "medication_admin"], calls: ["morning", "lunch", "tea", "bed"], genderPref: "female", pets: ["cat"], note: "Dementia; four calls a day." },
  { key: "reginald", name: "Reginald Cole", gender: "Male", area: "clarendon", language: "English", skills: ["personal_care"], calls: ["lunch"], excluded: [{ key: "daniel", reason: "Personality clash" }], note: "" },
  { key: "phyllis", name: "Phyllis Grant", gender: "Female", area: "aylestone", language: "English", skills: ["diabetes_care", "personal_care"], calls: ["morning", "tea"], nonSmoker: true, note: "Diabetic; prefers a non-smoker." },
];

// ── Scaling (npm run seed:roster -- --org <id> --scale 100) ─────────────────────────────────────
// For performance testing the roster UI: clone the hand-written people with new names and spread
// them across the areas. Clones keep the originals' skills, patterns and care packages (so the same
// eligibility rules apply) and their preferences keep pointing at the original carers.

const FIRST = ["Amelia", "Oliver", "Isla", "Noah", "Ava", "Arthur", "Mia", "Leo", "Freya", "Oscar", "Ivy", "Theo", "Ruby", "Harry", "Chloe", "Jack", "Sophie", "Ethan", "Layla", "Zain", "Nia", "Callum", "Esme", "Rohan", "Maya", "Ewan", "Tessa", "Imran", "Holly", "Dev", "Lena", "Kofi", "Anya", "Mateo", "Rosa", "Femi", "Ciara", "Yusuf", "Elin", "Marek"];
const LAST = ["Ahmed", "Baker", "Carter", "Davies", "Ellis", "Foster", "Grant", "Hughes", "Iqbal", "Jenkins", "Khan", "Lewis", "Morgan", "Nash", "Owen", "Patel", "Quinn", "Reed", "Shah", "Taylor", "Usher", "Vaughan", "Walsh", "Young", "Zaman", "Bell", "Cole", "Dixon", "Evans", "Fox", "Gill", "Hart", "Ito", "James", "Kerr", "Lowe", "Moss", "Noor", "Page", "Rowe"];
const AREA_KEYS = Object.keys(AREAS) as Area[];
const nameAt = (i: number) => `${FIRST[i % FIRST.length]} ${LAST[(i * 7 + Math.floor(i / FIRST.length)) % LAST.length]}`;

export function expandCarers(count: number): DemoCarer[] {
  if (count <= CARERS.length) return CARERS;
  const out = [...CARERS];
  for (let i = CARERS.length; i < count; i++) {
    const base = CARERS[i % CARERS.length];
    out.push({ ...base, key: `carer${i}`, name: nameAt(i), area: AREA_KEYS[i % AREA_KEYS.length], smoker: i % 9 === 0 ? true : base.smoker, note: `Scaled test carer (like ${base.name}).` });
  }
  return out;
}

export function expandClients(count: number): DemoClient[] {
  if (count <= CLIENTS.length) return CLIENTS;
  const out = [...CLIENTS];
  for (let i = CLIENTS.length; i < count; i++) {
    const base = CLIENTS[i % CLIENTS.length];
    out.push({ ...base, key: `client${i}`, name: nameAt(i + 3), area: AREA_KEYS[(i * 3) % AREA_KEYS.length], note: `Scaled test client (like ${base.name}).` });
  }
  return out;
}
