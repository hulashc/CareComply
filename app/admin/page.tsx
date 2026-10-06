import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Building2, Users, CreditCard, AlertTriangle, Shield } from "lucide-react";

export default async function AdminOverviewPage() {
  const admin = await getCurrentAdmin();
  if (!admin || !admin.is_superadmin) redirect("/dashboard");

  const supabase = createAdminClient();

  const [orgsRes, adminsRes] = await Promise.all([
    supabase.from("organizations").select("id, name, subscription_status, created_at"),
    supabase.from("admins").select("id, org_id"),
  ]);

  const orgs = orgsRes.data ?? [];
  const admins = adminsRes.data ?? [];

  const totalOrgs = orgs.length;
  const activeSubs = orgs.filter(o => o.subscription_status === "active").length;
  const trialSubs = orgs.filter(o => o.subscription_status === "trialing").length;
  const totalAdmins = admins.length;

  const thisMonth = new Date();
  thisMonth.setDate(1);
  const newThisMonth = orgs.filter(o => o.created_at && new Date(o.created_at) >= thisMonth).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Platform Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">CareComply platform health and metrics.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Organizations", value: totalOrgs, icon: Building2, color: "bg-blue-50 text-blue-700" },
          { label: "Active Subscriptions", value: activeSubs, icon: CreditCard, color: "bg-green-50 text-green-700" },
          { label: "Trial Subscriptions", value: trialSubs, icon: Shield, color: "bg-amber-50 text-amber-700" },
          { label: "Total Admin Users", value: totalAdmins, icon: Users, color: "bg-fuchsia-50 text-fuchsia-700" },
        ].map(stat => (
          <Card key={stat.label} className="rounded-xl border border-border/50 shadow-card">
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.color}`}>
                <stat.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="rounded-xl border border-border/50 shadow-card">
          <CardHeader><CardTitle className="text-base font-semibold">New This Month</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{newThisMonth}</p>
            <p className="text-xs text-muted-foreground mt-1">organizations created in {new Date().toLocaleString("default", { month: "long" })}</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-border/50 shadow-card">
          <CardHeader><CardTitle className="text-base font-semibold">Quick Actions</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Link href="/admin/organizations" className="block rounded-lg border p-3 text-sm hover:bg-muted/50 transition-colors">View all organizations →</Link>
            <Link href="/dashboard" className="block rounded-lg border p-3 text-sm hover:bg-muted/50 transition-colors">Go to main dashboard →</Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
