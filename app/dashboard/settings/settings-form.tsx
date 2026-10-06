"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, Pencil, Check, X, Loader2 } from "lucide-react";

export function SettingsForm({
  initialOrgName,
  initialAdminName,
  adminRole,
}: {
  initialOrgName: string;
  initialAdminName: string;
  adminRole: string;
}) {
  const [editing, setEditing] = useState(false);
  const [orgName, setOrgName] = useState(initialOrgName);
  const [adminName, setAdminName] = useState(initialAdminName);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleSave() {
    if (!orgName.trim() || !adminName.trim()) return;
    setSaving(true);
    const res = await fetch("/api/settings/org", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgName: orgName.trim(), fullName: adminName.trim() }),
    });
    if (res.ok) {
      setEditing(false);
      router.refresh();
    }
    setSaving(false);
  }

  function handleCancel() {
    setOrgName(initialOrgName);
    setAdminName(initialAdminName);
    setEditing(false);
  }

  return (
    <Card className="rounded-xl border border-border/50 shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-fuchsia-500">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle>Organisation</CardTitle>
              <CardDescription className="mt-0.5">Your care provider details.</CardDescription>
            </div>
          </div>
          {!editing ? (
            <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" className="rounded-xl h-8 px-2" onClick={handleCancel} disabled={saving}>
                <X className="h-4 w-4" />
              </Button>
              <Button size="sm" className="rounded-xl h-8 px-3 gap-1.5" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Save
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Organisation Name</label>
          <Input
            value={orgName}
            onChange={e => setOrgName(e.target.value)}
            className="rounded-xl mt-1"
            readOnly={!editing}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Your Name</label>
          <Input
            value={adminName}
            onChange={e => setAdminName(e.target.value)}
            className="rounded-xl mt-1"
            readOnly={!editing}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Your Role</label>
          <Input defaultValue={adminRole} className="rounded-xl mt-1 capitalize" readOnly />
        </div>
      </CardContent>
    </Card>
  );
}
