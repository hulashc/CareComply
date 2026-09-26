"use client";

import { Button } from "@/components/ui/button";
import { X, ArrowRight, Users, Heart, CalendarClock, Sparkles } from "lucide-react";
import Link from "next/link";

interface WelcomeChecklistProps {
  seatsPurchased: number;
  carerCount: number;
  onDismiss: () => void;
}

const steps = [
  { label: "Invite your carers", href: "/dashboard/invite-carer", icon: Users },
  { label: "Add your clients", href: "/dashboard/clients", icon: Heart },
  { label: "Schedule shifts", href: "/dashboard/shifts", icon: CalendarClock },
];

export function WelcomeChecklist({ seatsPurchased, carerCount, onDismiss }: WelcomeChecklistProps) {
  return (
    <div className="bg-gradient-to-b from-emerald-50/90 via-emerald-50/50 to-transparent dark:from-emerald-950/20 dark:via-emerald-950/5 dark:to-transparent border-b">
      <div className="mx-auto max-w-6xl px-6 py-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">Welcome aboard!</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                {seatsPurchased} seat{seatsPurchased !== 1 ? "s" : ""} ready · {carerCount} in use. Let&apos;s get your care home set up.
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={onDismiss}>
            <X className="h-3.5 w-3.5 text-emerald-700" />
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {steps.map((step, i) => (
            <Link key={step.href} href={step.href}>
              <div className="flex items-center gap-3 rounded-xl bg-white/80 dark:bg-emerald-950/30 p-3 hover:bg-white dark:hover:bg-emerald-950/50 transition-colors border border-emerald-100 dark:border-emerald-900/50">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{step.label}</p>
                  <step.icon className="h-4 w-4 text-emerald-400 mt-0.5" />
                </div>
                <ArrowRight className="h-4 w-4 text-emerald-400 shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
