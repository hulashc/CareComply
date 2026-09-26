import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";
import ApprovalActions from "./approval-actions";
import { StatusBadge } from "@/components/shared/status-badge";
import { MaskedField } from "@/components/shared/masked-field";
import { EmptyState } from "@/components/shared/empty-state";
import { DeleteButton } from "@/components/shared/delete-button";
import type { Tables } from "@/lib/database.types";

type ApplicationRow = Tables<"applications">;
type ApplicationDocRow = Tables<"application_documents">;

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: app } = await supabase
    .from("applications")
    .select("*")
    .eq("id", id)
    .single()
    .returns<ApplicationRow>();

  if (!app) {
    return (
      <div className="space-y-6">
        <Link href="/dashboard/applications">
          <Button variant="ghost" size="sm" className="rounded-xl gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Applications
          </Button>
        </Link>
        <Card className="rounded-2xl shadow-card border-0">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/40" />
            <h3 className="mt-4 text-lg font-medium">Application Not Found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              This application does not exist or has been removed.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: docs } = await supabase
    .from("application_documents")
    .select("*")
    .eq("application_id", id)
    .returns<ApplicationDocRow[]>();

  const adminClient = createAdminClient();
  const docsWithUrls = await Promise.all(
    (docs || []).map(async (doc) => {
      const { data } = await adminClient.storage
        .from("applicant-documents")
        .createSignedUrl(doc.file_path, 60 * 10);
      return { ...doc, signedUrl: data?.signedUrl };
    })
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <Link href="/dashboard/applications">
          <Button variant="ghost" size="sm" className="rounded-xl gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Applications
          </Button>
        </Link>
        <DeleteButton apiUrl={`/api/admin/applications/${id}/delete`} entityName="application" redirectTo="/dashboard/applications" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{app.full_name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Submitted {app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : "N/A"}
          </p>
        </div>
        <div><StatusBadge status={app.status} /></div>
      </div>

      <Card className="rounded-2xl shadow-card border-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Personal Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="sm:col-span-2"><span className="text-muted-foreground">Email</span> <p className="font-medium">{app.email || "-"}</p></div>
          <div className="sm:col-span-2"><span className="text-muted-foreground">Phone</span> <p className="font-medium">{app.phone || "-"}</p></div>
          <MaskedField label="Date of Birth" value={app.date_of_birth} />
          <MaskedField label="NI Number" value={app.national_insurance_number} />
          <div className="sm:col-span-2"><span className="text-muted-foreground">Address</span> <p className="font-medium">{app.address}, {app.postcode}</p></div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-card border-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Right to Work</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div><span className="text-muted-foreground">UK Right to Work</span> <p className="font-medium">{app.right_to_work_uk ? "Yes" : "No"}</p></div>
          <div><span className="text-muted-foreground">UK/EEA Citizen</span> <p className="font-medium">{app.is_uk_eea_citizen ? "Yes" : "No"}</p></div>
          {!app.is_uk_eea_citizen && (
            <>
              <div><span className="text-muted-foreground">Visa Status</span> <p className="font-medium">{app.visa_status || "-"}</p></div>
              <div><span className="text-muted-foreground">Visa Number</span> <p className="font-medium">{app.visa_number || "-"}</p></div>
              <div><span className="text-muted-foreground">Sharecode</span> <p className="font-medium">{app.sharecode || "-"}</p></div>
              <div><span className="text-muted-foreground">Country of Origin</span> <p className="font-medium">{app.country_of_origin || "-"}</p></div>
            </>
          )}
          <div><span className="text-muted-foreground">Driving Licence</span> <p className="font-medium">{app.has_driving_licence ? "Yes" : "No"}</p></div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-card border-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Bank Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div><span className="text-muted-foreground">Account Name</span> <p className="font-medium">{app.bank_account_name || "-"}</p></div>
          <MaskedField label="Account Number" value={app.bank_account_number} />
          <MaskedField label="Sort Code" value={app.bank_sort_code} />
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-card border-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Next of Kin &amp; References</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="sm:col-span-2"><span className="text-muted-foreground">Next of Kin</span> <p className="font-medium">{app.next_of_kin_name} ({app.next_of_kin_relationship})</p></div>
          <div className="sm:col-span-2"><span className="text-muted-foreground">Phone</span> <p className="font-medium">{app.next_of_kin_phone}</p></div>
          <Separator className="col-span-full my-1" />
          <div><span className="text-muted-foreground">Referee 1</span> <p className="font-medium">{app.referee_1_name} &mdash; {app.referee_1_relationship}</p></div>
          <div><span className="text-muted-foreground">Contact</span> <p className="font-medium">{app.referee_1_contact}</p></div>
          <div><span className="text-muted-foreground">Referee 2</span> <p className="font-medium">{app.referee_2_name} &mdash; {app.referee_2_relationship}</p></div>
          <div><span className="text-muted-foreground">Contact</span> <p className="font-medium">{app.referee_2_contact}</p></div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-card border-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Safeguarding &amp; Declaration</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div><span className="text-muted-foreground">Convictions</span> <p className="font-medium">{app.has_convictions_to_disclose ? "Yes" : "No"}</p></div>
          {app.has_convictions_to_disclose && (
            <div className="sm:col-span-2"><span className="text-muted-foreground">Details</span> <p className="font-medium">{app.conviction_details}</p></div>
          )}
          <div><span className="text-muted-foreground">DBS Consent</span> <p className="font-medium">{app.consents_to_dbs_check ? "Yes" : "No"}</p></div>
          <div><span className="text-muted-foreground">Signature</span> <p className="font-medium">{app.signature_typed_name}</p></div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-card border-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {docsWithUrls.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No documents"
              description="This application has no uploaded documents."
            />
          ) : (
            <div className="space-y-2">
              {docsWithUrls.map((doc) => (
                <div key={doc.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl bg-muted/50 px-4 py-3 text-sm">
                  <div>
                    <span className="font-medium capitalize">{doc.document_category.replace("_", " ")}</span>
                    <p className="text-xs text-muted-foreground">{doc.file_name}</p>
                  </div>
                  {doc.signedUrl && (
                    <a
                      href={doc.signedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-primary hover:underline shrink-0"
                    >
                      View Document
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {app.status === "pending_review" && (
        <ApprovalActions applicationId={app.id} />
      )}
    </div>
  );
}
