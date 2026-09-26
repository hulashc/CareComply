import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { Building2 } from "lucide-react";

export default async function AdminOrganizationsPage() {
  const admin = await getCurrentAdmin();
  if (!admin || !admin.is_superadmin) redirect("/dashboard");

  const supabase = createAdminClient();

  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, subscription_status, seats_purchased, created_at")
    .order("created_at", { ascending: false });

  const { data: adminCounts } = await supabase.from("admins").select("org_id");

  const countMap = new Map<string, number>();
  (adminCounts ?? []).forEach(a => { if (a.org_id) countMap.set(a.org_id, (countMap.get(a.org_id) ?? 0) + 1); });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Organizations</h1>
        <p className="mt-1 text-sm text-muted-foreground">{orgs?.length ?? 0} total</p>
      </div>

      <Card className="rounded-xl border border-border/50 shadow-card">
        <CardContent className="p-0">
          {(!orgs || orgs.length === 0) ? (
            <EmptyState icon={Building2} title="No organizations" description="Organizations will appear here once carers sign up." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Name</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Status</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Seats</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Admins</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgs.map(org => (
                  <TableRow key={org.id}>
                    <TableCell className="font-medium">{org.name}</TableCell>
                    <TableCell>
                      <Badge variant={org.subscription_status === "active" ? "default" : org.subscription_status === "trialing" ? "outline" : "secondary"}>
                        {org.subscription_status ?? "none"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{org.seats_purchased ?? 0}</TableCell>
                    <TableCell className="text-muted-foreground">{countMap.get(org.id) ?? 0}</TableCell>
                    <TableCell className="text-muted-foreground">{org.created_at ? new Date(org.created_at).toLocaleDateString() : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
