import { notFound, redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { createProfileDb, rowToCarerValues } from "@/lib/services/profile-service";
import { CarerWizard } from "@/components/forms/carer-wizard";

export default async function EditCarerPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin?.org_id) redirect("/login");
  const { id } = await params;

  const db = createProfileDb();
  const [{ data: carer }, { data: contacts }, { data: references }] = await Promise.all([
    db.from("carers").select("*").eq("id", id).eq("org_id", admin.org_id).maybeSingle(),
    db.from("carer_contacts").select("*").eq("carer_id", id).eq("org_id", admin.org_id).order("created_at"),
    db.from("carer_references").select("*").eq("carer_id", id).eq("org_id", admin.org_id).order("created_at"),
  ]);
  if (!carer) notFound();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Edit {carer.full_name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          National Insurance and bank details are stored encrypted and not shown. Leave them blank to keep the current values.
        </p>
      </div>
      <CarerWizard carerId={id} initialValues={rowToCarerValues(carer, contacts ?? [], references ?? [])} />
    </div>
  );
}
