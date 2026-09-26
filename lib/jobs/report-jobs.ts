import type { Job } from "./queue";
import { createAdminClient } from "@/lib/supabase/admin";

export async function processReportJob(job: Job): Promise<void> {
  const p = job.payload;

  switch (job.type) {
    case "report:compliance_export":
      await generateComplianceExport(p.orgId as string, p.adminEmail as string);
      break;
    case "report:incident_export":
      await generateIncidentExport(p.orgId as string, p.adminEmail as string);
      break;
    default:
      throw new Error(`Unknown report job type: ${job.type}`);
  }
}

async function generateComplianceExport(orgId: string, adminEmail: string): Promise<void> {
  const supabase = createAdminClient();

  const [carersRes, docsRes, incidentsRes] = await Promise.all([
    supabase.from("carers").select("full_name, role, status").eq("org_id", orgId),
    supabase.from("documents").select("owner_id, document_types(name), status, expiry_date").eq("org_id", orgId).is("deleted_at", null),
    supabase.from("incidents").select("title, severity, status, reported_at").eq("org_id", orgId),
  ]);

  const rows = [
    ["CareComply Compliance Export", new Date().toISOString()].join(","),
    "",
    "Carers",
    "Name,Role,Status",
    ...(carersRes.data ?? []).map(c => [c.full_name, c.role, c.status].join(",")),
    "",
    "Documents",
    "Document,Status,Expiry",
    ...(docsRes.data ?? []).map(d => [d.document_types?.name ?? "Unknown", d.status, d.expiry_date].join(",")),
    "",
    "Incidents",
    "Title,Severity,Status,Date",
    ...(incidentsRes.data ?? []).map(i => [i.title, i.severity, i.status, i.reported_at].join(",")),
  ];

  const csv = rows.join("\n");
  console.log(`[Job] Compliance export generated for ${adminEmail}: ${csv.length} bytes`);
}

async function generateIncidentExport(orgId: string, adminEmail: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: incidents } = await supabase
    .from("incidents")
    .select("title, description, severity, category, status, reported_at, action_taken")
    .eq("org_id", orgId)
    .order("reported_at", { ascending: false });

  const rows = [
    "Title,Severity,Category,Status,Date,Action Taken",
    ...(incidents ?? []).map(i =>
      [i.title, i.severity, i.category, i.status, i.reported_at, i.action_taken ?? ""].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")
    ),
  ];

  const csv = rows.join("\n");
  console.log(`[Job] Incident export generated for ${adminEmail}: ${csv.length} bytes`);
}
