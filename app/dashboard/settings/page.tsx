import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Database, CreditCard, Users, Shield, LogIn, User } from "lucide-react";
import Link from "next/link";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: admin } = await supabase
    .from("admins")
    .select("*, organizations(name)")
    .eq("id", user?.id ?? "")
    .single();
  const { data: docTypes } = await supabase.from("document_types").select("*").order("name");

  const adminClient = createAdminClient();
  const [admins, carers] = await Promise.all([
    adminClient.from("admins").select("id, full_name, role, is_superadmin").eq("org_id", admin?.org_id ?? "").order("full_name"),
    adminClient.from("carers").select("id, full_name, email, role, auth_id, status").eq("org_id", admin?.org_id ?? "").order("full_name"),
  ]);

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your organisation.</p>
      </div>

      <SettingsForm
        initialOrgName={admin?.organizations?.name ?? ""}
        initialAdminName={admin?.full_name ?? ""}
        adminRole={admin?.role ?? "Admin"}
      />

      <Card className="rounded-xl border border-border/50 shadow-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent"><Users className="h-5 w-5 text-accent-foreground" /></div>
            <div><CardTitle>Team</CardTitle><CardDescription className="mt-0.5">Admins and carers in your organisation.</CardDescription></div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Admins ({(admins.data ?? []).length})</h3>
            </div>
            <div className="space-y-2">
              {(admins.data ?? []).map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                      {a.full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) ?? "A"}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{a.full_name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{a.role?.replace("_", " ")}{a.is_superadmin ? " · Super Admin" : ""}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="rounded-md text-[10px] bg-blue-100 text-blue-700 border-blue-300">Admin</Badge>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Carers ({(carers.data ?? []).length})</h3>
            </div>
            <div className="space-y-2">
              {(carers.data ?? []).map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-xs font-bold text-amber-700">
                      {c.full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) ?? "C"}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{c.full_name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{c.role?.replace("_", " ")}{c.email ? ` · ${c.email}` : ""}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`rounded-md text-[10px] ${c.auth_id ? "bg-green-100 text-green-700 border-green-300" : "bg-gray-100 text-gray-700 border-gray-300"}`}>
                      {c.auth_id ? <><LogIn className="h-3 w-3 inline mr-1" />Can login</> : "No login"}
                    </Badge>
                    <Badge variant="outline" className={`rounded-md text-[10px] ${c.status === "active" ? "bg-green-100 text-green-700 border-green-300" : "bg-gray-100 text-gray-700 border-gray-300"}`}>
                      {c.status ?? "active"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-border/50 shadow-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent"><CreditCard className="h-5 w-5 text-accent-foreground" /></div>
            <div><CardTitle>Billing & Plan</CardTitle><CardDescription className="mt-0.5">Manage your subscription.</CardDescription></div>
          </div>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="rounded-xl gap-2">
            <Link href="/dashboard/settings/billing">
              <CreditCard className="h-4 w-4" /> View Billing
            </Link>
          </Button>
        </CardContent>
      </Card>

      {docTypes && docTypes.length > 0 && (
        <Card className="rounded-xl border border-border/50 shadow-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent"><Database className="h-5 w-5 text-accent-foreground" /></div>
              <div><CardTitle>Document Types</CardTitle><CardDescription className="mt-0.5">{docTypes.length} types configured.</CardDescription></div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {docTypes.map((dt) => (
                <div key={dt.id} className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3 text-sm">
                  <span className="font-medium">{dt.name}</span>
                  {dt.is_mandatory && <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Required</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
