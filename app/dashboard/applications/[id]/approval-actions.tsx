"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useToast } from "@/components/shared/toast";

export default function ApprovalActions({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showConfirmApprove, setShowConfirmApprove] = useState(false);

  async function handleApprove() {
    setShowConfirmApprove(false);
    setLoading(true);
    setError("");
    const res = await fetch(`/api/admin/applications/${applicationId}/approve`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Something went wrong");
      setLoading(false);
      return;
    }
    router.refresh();
    toast("Application approved");
  }

  async function handleReject() {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/admin/applications/${applicationId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Something went wrong");
      setLoading(false);
      return;
    }
    router.refresh();
    toast("Application rejected");
  }

  return (
    <>
      <ConfirmDialog
        open={showConfirmApprove}
        title="Approve Application"
        description="This will create a carer record and migrate all documents. This action cannot be undone."
        confirmLabel="Yes, Approve"
        onConfirm={handleApprove}
        onCancel={() => setShowConfirmApprove(false)}
      />

      <Card className="rounded-2xl shadow-card border-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Decision</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          {!rejecting ? (
            <div className="flex gap-3">
              <Button onClick={() => setShowConfirmApprove(true)} disabled={loading} className="rounded-xl">
                {loading ? "Approving..." : "Approve Application"}
              </Button>
              <Button variant="outline" onClick={() => setRejecting(true)} disabled={loading} className="rounded-xl border-red-200 text-destructive hover:bg-red-50 hover:text-destructive">
                Reject
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Textarea placeholder="Reason for rejection (optional)..." value={reason} onChange={(e) => setReason(e.target.value)} className="rounded-xl" />
              <div className="flex gap-3">
                <Button variant="destructive" onClick={handleReject} disabled={loading} className="rounded-xl">
                  {loading ? "Rejecting..." : "Confirm Rejection"}
                </Button>
                <Button variant="ghost" onClick={() => setRejecting(false)} disabled={loading} className="rounded-xl">
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
