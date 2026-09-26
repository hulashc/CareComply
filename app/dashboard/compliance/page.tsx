import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileCheck, ShieldCheck, AlertTriangle, CheckCircle2, Users, Heart, Clock, Download, XCircle } from "lucide-react";
import { ComplianceScore } from "@/components/shared/compliance-score";
import { ExportButton } from "./export-button";

export default async function CompliancePage() {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  const orgId = admin?.org_id ?? "";

  const { data: documents } = await supabase.from("documents").select("*").eq("org_id", orgId).is("deleted_at", null);
  const { count: carerCount } = await supabase.from("carers").select("*", { count: "exact", head: true }).eq("org_id", orgId);
  const { count: clientCount } = await supabase.from("clients").select("*", { count: "exact", head: true }).eq("org_id", orgId);
  const { count: openIncidents } = await supabase.from("incidents").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "open");

  const green = documents?.filter(d => d.status === "green").length ?? 0;
  const amber = documents?.filter(d => d.status === "amber").length ?? 0;
  const red = documents?.filter(d => d.status === "red").length ?? 0;
  const total = green + amber + red;
  const score = total === 0 ? 0 : Math.round((green / total) * 100);

  // CQC checklist data queries
  const { count: totalClients } = await supabase.from("clients").select("*", { count: "exact", head: true }).eq("org_id", orgId);
  const { count: clientsWithCarePlans } = await supabase.from("care_plans").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "active");

  const { data: carers } = await supabase.from("carers").select("id").eq("org_id", orgId);
  const { data: carerDocs } = await supabase.from("documents").select("owner_id, document_types(name)").eq("org_id", orgId).eq("owner_type", "carer").is("deleted_at", null);

  const today = new Date().toISOString().split("T")[0];
  const { count: overdueQualifications } = await supabase.from("qualifications").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "expired");

  // Check: all carers have DBS checks
  const carerIds = (carers ?? []).map(c => c.id);
  const dbsDocNames = ["DBS Certificate", "DBS Check"];
  const carersWithDBS = new Set(
    (carerDocs ?? [])
      .filter(d => dbsDocNames.includes(d.document_types?.name ?? ""))
      .map(d => d.owner_id)
  );
  const allCarersHaveDBS = carerIds.length > 0 && carerIds.every(id => carersWithDBS.has(id));

  // Check: all clients have active care plans
  const allClientsHaveCarePlans = (totalClients ?? 0) > 0 && (clientsWithCarePlans ?? 0) >= (totalClients ?? 0);

  // Check: staff training up to date (no expired qualifications)
  const trainingUpToDate = (overdueQualifications ?? 0) === 0;

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">CQC Compliance Report</h1>
          <p className="mt-1 text-sm text-muted-foreground">Evidence pack for inspections.</p>
        </div>
        <ExportButton />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-xl border border-border/50 shadow-card">
          <CardContent className="p-5 text-center">
            <div className="flex justify-center mb-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-primary/20">
                <span className="text-2xl font-bold text-primary">{score}%</span>
              </div>
            </div>
            <p className="text-sm font-medium">Compliance Score</p>
            <p className="text-xs text-muted-foreground">{green} compliant out of {total}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-border/50 shadow-card">
          <CardContent className="flex items-center gap-3 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><Users className="h-5 w-5 text-primary" /></div>
            <div><p className="text-2xl font-bold">{carerCount ?? 0}</p><p className="text-xs text-muted-foreground">Registered Carers</p></div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-border/50 shadow-card">
          <CardContent className="flex items-center gap-3 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><Heart className="h-5 w-5 text-primary" /></div>
            <div><p className="text-2xl font-bold">{clientCount ?? 0}</p><p className="text-xs text-muted-foreground">Active Clients</p></div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-border/50 shadow-card">
          <CardContent className="flex items-center gap-3 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100"><AlertTriangle className="h-5 w-5 text-red-700" /></div>
            <div><p className="text-2xl font-bold">{openIncidents ?? 0}</p><p className="text-xs text-muted-foreground">Open Incidents</p></div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border border-border/50 shadow-card">
        <CardHeader><CardTitle className="text-lg font-semibold">Document Compliance Breakdown</CardTitle></CardHeader>
        <CardContent>
          <ComplianceScore green={green} amber={amber} red={red} />
          <div className="mt-6 grid grid-cols-3 gap-4 text-center">
            <div className="rounded-xl bg-green-50 p-4">
              <p className="text-3xl font-bold text-green-700">{green}</p>
              <p className="text-xs text-green-600 font-medium">Compliant</p>
              <p className="text-xs text-muted-foreground mt-1">Up-to-date documents</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-4">
              <p className="text-3xl font-bold text-amber-700">{amber}</p>
              <p className="text-xs text-amber-600 font-medium">Expiring Soon</p>
              <p className="text-xs text-muted-foreground mt-1">Within 30 days</p>
            </div>
            <div className="rounded-xl bg-red-50 p-4">
              <p className="text-3xl font-bold text-red-700">{red}</p>
              <p className="text-xs text-red-600 font-medium">Expired</p>
              <p className="text-xs text-muted-foreground mt-1">Action required</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-border/50 shadow-card">
        <CardHeader><CardTitle className="text-lg font-semibold">CQC Readiness Checklist</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { label: "Document compliance > 80%", pass: score >= 80 },
              { label: "No open critical incidents", pass: (openIncidents ?? 0) < 2 },
              { label: `All carers have DBS checks (${carersWithDBS.size}/${carerIds.length})`, pass: allCarersHaveDBS },
              { label: `Care plans in place for all clients (${clientsWithCarePlans ?? 0}/${totalClients ?? 0})`, pass: allClientsHaveCarePlans },
              { label: "Staff training up to date", pass: trainingUpToDate },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3 text-sm">
                <span>{item.label}</span>
                {item.pass ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
