import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, ArrowLeft, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { SUBSCRIPTION_CONFIG, SUBSCRIPTION_STATUS, isSubscriptionActive } from "@/lib/config/subscription";
import { ManageSubscriptionButton } from "./manage-button";
import { SubscriptionSyncer } from "@/components/shared/subscription-syncer";

function StatusBadge({ status }: { status: string | null }) {
  const config: Record<string, { label: string; icon: React.ReactNode; variant: "success" | "destructive" | "warning" | "secondary" }> = {
    [SUBSCRIPTION_STATUS.ACTIVE]: { label: "Active", icon: <CheckCircle2 className="h-3.5 w-3.5" />, variant: "success" },
    [SUBSCRIPTION_STATUS.PAST_DUE]: { label: "Past Due", icon: <AlertCircle className="h-3.5 w-3.5" />, variant: "destructive" },
    [SUBSCRIPTION_STATUS.CANCELED]: { label: "Canceled", icon: <XCircle className="h-3.5 w-3.5" />, variant: "secondary" },
    [SUBSCRIPTION_STATUS.INCOMPLETE]: { label: "Incomplete", icon: <AlertCircle className="h-3.5 w-3.5" />, variant: "warning" },
    [SUBSCRIPTION_STATUS.UNPAID]: { label: "Unpaid", icon: <AlertCircle className="h-3.5 w-3.5" />, variant: "destructive" },
  };

  const c = config[status ?? ""] ?? { label: status ?? "None", icon: <XCircle className="h-3.5 w-3.5" />, variant: "secondary" as const };

  const variantClasses: Record<string, string> = {
    success: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
    destructive: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
    warning: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
    secondary: "bg-muted text-muted-foreground border-border",
  };

  return (
    <Badge variant="outline" className={`gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg ${variantClasses[c.variant]}`}>
      {c.icon}{c.label}
    </Badge>
  );
}

async function BillingContent() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return (
      <div className="space-y-8 max-w-2xl">
        <p className="text-muted-foreground">Unable to load billing information.</p>
      </div>
    );
  }

  const { data: admin } = await supabase
    .from("admins")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!admin?.org_id) {
    return (
      <div className="space-y-8 max-w-2xl">
        <p className="text-muted-foreground">Unable to load billing information.</p>
      </div>
    );
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("subscription_status, seats_purchased, stripe_customer_id, subscription_id")
    .eq("id", admin.org_id)
    .single();

  const { count: carerCount } = await supabase
    .from("carers")
    .select("*", { count: "exact", head: true })
    .eq("org_id", admin.org_id);

  const status = org?.subscription_status ?? null;
  const seatsPurchased = org?.seats_purchased ?? 0;
  const activeCares = carerCount ?? 0;
  const isActive = isSubscriptionActive(status);
  const monthlyCost = seatsPurchased * SUBSCRIPTION_CONFIG.pricePerSeat;

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" asChild>
            <Link href="/dashboard/settings"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Billing & Plan</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground ml-10">Manage your subscription and billing details.</p>
      </div>

      <Card className="rounded-xl border border-border/50 shadow-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
              <CreditCard className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <CardTitle>Current Plan</CardTitle>
              <CardDescription className="mt-0.5">Per-seat subscription at {SUBSCRIPTION_CONFIG.currency.toUpperCase()} {SUBSCRIPTION_CONFIG.pricePerSeat}/carer/month.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-muted/50 p-4">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Status</p>
              <div className="mt-1.5"><StatusBadge status={status} /></div>
            </div>
            <div className="rounded-xl bg-muted/50 p-4">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Monthly Cost</p>
              <p className="mt-1 text-xl font-bold">{isActive ? `£${monthlyCost}` : "—"}</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-4">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Seats Purchased</p>
              <p className="mt-1 text-xl font-bold">{isActive ? seatsPurchased : "—"}</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-4">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Active Carers</p>
              <p className="mt-1 text-xl font-bold">{activeCares}</p>
            </div>
          </div>

          {status === SUBSCRIPTION_STATUS.PAST_DUE && (
            <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-800 dark:text-red-300">Payment Past Due</p>
                <p className="text-sm text-red-700 dark:text-red-400">
                  Your last payment failed. Please update your payment method to restore access.
                </p>
              </div>
            </div>
          )}

          {!isActive && (
            <div className="rounded-xl border border-muted-foreground/20 bg-muted/30 p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">No Active Subscription</p>
                <p className="text-sm text-muted-foreground">
                  Subscribe to CareComply at {SUBSCRIPTION_CONFIG.currency.toUpperCase()} {SUBSCRIPTION_CONFIG.pricePerSeat}/carer/month to manage your care compliance.
                </p>
              </div>
            </div>
          )}

          <Suspense fallback={null}>
            <SubscriptionSyncer
              isActive={isActive}
              seatsPurchased={seatsPurchased}
              carerCount={activeCares}
              monthlyCost={monthlyCost}
              hasStripeCustomer={!!org?.stripe_customer_id}
              hasSubscriptionId={!!org?.subscription_id}
            />
          </Suspense>

          <div className="flex gap-3">
            <ManageSubscriptionButton
              hasSubscription={!!org?.stripe_customer_id && !!org?.subscription_id}
              carerCount={activeCares}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-8 max-w-2xl">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-48 rounded-lg bg-muted" />
            <div className="h-48 rounded-2xl bg-muted" />
          </div>
        </div>
      }
    >
      <BillingContent />
    </Suspense>
  );
}
