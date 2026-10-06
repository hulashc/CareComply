import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { createProfileDb } from "@/lib/services/profile-service";
import { ClientWizard } from "@/components/forms/client-wizard";

export default async function AddClientPage() {
  const admin = await getCurrentAdmin();
  if (!admin?.org_id) redirect("/login");

  const { data: carers } = await createProfileDb()
    .from("carers")
    .select("id, full_name")
    .eq("org_id", admin.org_id)
    .order("full_name");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Add Client</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Register a new client with the information needed for safe, person-centred care.
        </p>
      </div>
      <ClientWizard carers={carers ?? []} />
    </div>
  );
}
