import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AdminAdminsPage() {
  const admin = await getCurrentAdmin();
  if (!admin || !admin.is_superadmin) redirect("/dashboard");

  const supabase = createAdminClient();

  const { data: adminsList } = await supabase
    .from("admins")
    .select("id, full_name, role, is_superadmin, org_id, organizations(name)")
    .order("id");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">{adminsList?.length ?? 0} total</p>
      </div>

      <Card className="rounded-xl border border-border/50 shadow-card">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Organization</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">ID</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(adminsList ?? []).map(a => (
                  <tr key={a.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{a.full_name ?? "Unnamed"}</td>
                    <td className="px-4 py-3">
                      {a.is_superadmin ? (
                        <Badge variant="destructive">Super Admin</Badge>
                      ) : (
                        <Badge variant="outline">{a.role ?? "admin"}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{(Array.isArray(a.organizations) ? a.organizations[0]?.name : a.organizations?.name) ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{a.id.slice(0, 8)}...</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
