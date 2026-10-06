import { notFound, redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { createProfileDb, rowToClientValues } from "@/lib/services/profile-service";
import { ClientWizard } from "@/components/forms/client-wizard";

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin?.org_id) redirect("/login");
  const { id } = await params;

  const db = createProfileDb();
  const [{ data: client }, { data: contacts }, { data: carers }] = await Promise.all([
    db.from("clients").select("*").eq("id", id).eq("org_id", admin.org_id).maybeSingle(),
    db.from("client_contacts").select("*").eq("client_id", id).eq("org_id", admin.org_id).order("created_at"),
    db.from("carers").select("id, full_name").eq("org_id", admin.org_id).order("full_name"),
  ]);
  if (!client) notFound();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Edit {client.full_name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Changes are recorded in the audit log.</p>
      </div>
      <ClientWizard clientId={id} carers={carers ?? []} initialValues={rowToClientValues(client, contacts ?? [])} />
    </div>
  );
}
