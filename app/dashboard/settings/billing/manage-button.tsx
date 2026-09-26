"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, Settings, AlertCircle, Minus, Plus } from "lucide-react";
import { SUBSCRIPTION_CONFIG } from "@/lib/config/subscription";

interface ManageSubscriptionButtonProps {
  hasSubscription: boolean;
  carerCount: number;
}

export function ManageSubscriptionButton({ hasSubscription, carerCount }: ManageSubscriptionButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seats, setSeats] = useState(Math.max(carerCount, 1));

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const successUrl = `${appUrl}/dashboard/settings/billing?success=true`;
  const cancelUrl = `${appUrl}/dashboard/settings/billing?canceled=true`;
  const returnUrl = `${appUrl}/dashboard/settings/billing`;

  async function handleSubscribe() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ successUrl, cancelUrl, seats }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Server error (${res.status}).`);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError("No checkout URL returned from Stripe.");
      }
    } catch (err) {
      setError(`Network error: ${err instanceof Error ? err.message : "Unknown"}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleManageBilling() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Server error (${res.status}).`);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError("No portal URL returned from Stripe.");
      }
    } catch (err) {
      setError(`Network error: ${err instanceof Error ? err.message : "Unknown"}`);
    } finally {
      setLoading(false);
    }
  }

  if (hasSubscription) {
    return (
      <div className="space-y-3">
        <div className="flex gap-3">
          <Button onClick={handleManageBilling} disabled={loading} variant="outline" className="rounded-xl gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
            Manage Billing
          </Button>
        </div>
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  }

  const monthlyCost = seats * SUBSCRIPTION_CONFIG.pricePerSeat;
  const minSeats = Math.max(carerCount, 1);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border/50 p-5 space-y-4">
        <div className="flex items-center justify-center gap-4">
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => setSeats((s) => Math.max(s - 1, minSeats))} disabled={loading || seats <= minSeats}>
            <Minus className="h-4 w-4" />
          </Button>
          <div className="text-center min-w-[60px]">
            <span className="text-3xl font-bold tabular-nums">{seats}</span>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">seat{seats !== 1 ? "s" : ""}</p>
          </div>
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => setSeats((s) => Math.min(s + 1, 1000))} disabled={loading}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            {seats} &times; £{SUBSCRIPTION_CONFIG.pricePerSeat}
          </span>
          <span className="font-bold">£{monthlyCost}<span className="font-normal text-muted-foreground text-xs">/month</span></span>
        </div>

        <Button onClick={handleSubscribe} disabled={loading} className="w-full rounded-xl gold-accent hover:brightness-110 shadow-glow">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CreditCard className="h-4 w-4 mr-2" />}
          {loading ? "Redirecting..." : `Subscribe — £${monthlyCost}/month`}
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
