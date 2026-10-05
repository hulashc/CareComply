"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, Sparkles, Users, Heart, CalendarClock, ArrowRight } from "lucide-react";
import Link from "next/link";

interface SubscriptionSyncerProps {
  isActive: boolean;
  seatsPurchased: number;
  carerCount: number;
  monthlyCost: number;
  hasStripeCustomer: boolean;
  hasSubscriptionId: boolean;
}

const nextSteps = [
  { label: "Add your carers", desc: "Create carer profiles and invite them to the platform.", href: "/dashboard/carers", icon: Users },
  { label: "Add your clients", desc: "Set up care recipients with care plans and medications.", href: "/dashboard/clients", icon: Heart },
  { label: "Schedule shifts", desc: "Build your roster so carers know when to work.", href: "/dashboard/shifts", icon: CalendarClock },
];

export function SubscriptionSyncer({ isActive, seatsPurchased, carerCount, monthlyCost, hasSubscriptionId }: SubscriptionSyncerProps) {
  const searchParams = useSearchParams();
  const justPaid = searchParams.get("success") === "true";
  const [syncing, setSyncing] = useState(justPaid);
  const [synced, setSynced] = useState(false);
  const [syncedSeats, setSyncedSeats] = useState(seatsPurchased);
  const [syncedCost, setSyncedCost] = useState(monthlyCost);

  useEffect(() => {
    if (!justPaid) return;

    async function sync() {
      try {
        const res = await fetch("/api/stripe/subscription");
        const data = await res.json();
        if (data.subscription) {
          setSyncedSeats(data.subscription.seats);
          setSyncedCost(data.subscription.monthlyCost);
          setSynced(true);
          setSyncing(false);
          sessionStorage.setItem("just_subscribed", "true");
          return;
        }
      } catch {} finally {
        setSyncing(false);
      }
    }
    sync();
  }, [justPaid]);

  function goToDashboard() {
    window.location.href = "/dashboard?welcome=subscribed";
  }

  if (justPaid) {
    return (
      <div className="space-y-6">
        {syncing ? (
          <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 p-6 text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto" />
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Confirming your subscription...</p>
          </div>
        ) : synced ? (
          <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 p-6 space-y-5">
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100">
                <Sparkles className="h-7 w-7 text-emerald-600" />
              </div>
              <h2 className="mt-3 text-xl font-bold text-emerald-800 dark:text-emerald-300">You&apos;re all set!</h2>
              <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">
                {syncedSeats} seat{syncedSeats !== 1 ? "s" : ""} active at £{syncedCost}/month.
              </p>
            </div>

            <div className="border-t border-emerald-200 dark:border-emerald-800 pt-4">
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-3">Ready to get started?</p>
              <div className="space-y-2">
                {nextSteps.map((step, i) => (
                  <Link key={step.href} href={step.href} className="block">
                    <div className="flex items-center gap-3 rounded-xl bg-white/70 dark:bg-emerald-950/30 p-3 hover:bg-white dark:hover:bg-emerald-950/50 transition-colors border border-emerald-100 dark:border-emerald-900">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{step.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{step.desc}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-emerald-400 shrink-0" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <Button onClick={goToDashboard} className="w-full rounded-xl gold-accent hover:brightness-110 shadow-glow">
              Go to Dashboard
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4 text-center">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Payment processed. Your subscription will update shortly.{" "}
              <button className="underline font-medium" onClick={() => window.location.reload()}>Refresh</button>
            </p>
          </div>
        )}
      </div>
    );
  }

  if (isActive && hasSubscriptionId) {
    return (
      <div className="rounded-xl border border-emerald-200/50 bg-emerald-50/30 dark:bg-emerald-950/10 p-4 flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
        <div>
          <p className="text-sm font-medium">{seatsPurchased} seat{seatsPurchased !== 1 ? "s" : ""} active</p>
          <p className="text-xs text-muted-foreground">£{monthlyCost}/month · {carerCount} current carer{carerCount !== 1 ? "s" : ""}</p>
        </div>
      </div>
    );
  }

  return null;
}
