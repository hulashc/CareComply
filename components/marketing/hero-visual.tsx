import { CheckCircle2, FileCheck, Users, Bell } from "lucide-react";

export function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-md animate-float-slow lg:mx-0" aria-hidden="true">
      <div className="absolute -inset-4 rounded-[2rem] bg-white/10 blur-2xl" />
      <div className="glass-card relative overflow-hidden rounded-2xl border border-white/20 bg-white/95 shadow-elevated">
        {/* browser chrome */}
        <div className="flex items-center gap-1.5 border-b border-border/40 bg-muted/40 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          <span className="ml-3 text-[11px] font-medium text-muted-foreground">app.carecomply.co.uk</span>
        </div>

        <div className="space-y-4 p-5">
          {/* compliance score */}
          <div className="flex items-center gap-4 rounded-xl border border-border/40 bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
            <svg width="56" height="56" viewBox="0 0 56 56" className="shrink-0">
              <circle cx="28" cy="28" r="24" fill="none" stroke="hsl(230 15% 91%)" strokeWidth="6" />
              <circle
                cx="28" cy="28" r="24" fill="none"
                stroke="hsl(160 60% 40%)" strokeWidth="6" strokeLinecap="round"
                strokeDasharray="150.8" strokeDashoffset="14"
                transform="rotate(-90 28 28)"
              />
            </svg>
            <div>
              <p className="text-xl font-bold leading-none text-foreground">94%</p>
              <p className="mt-1 text-xs text-muted-foreground">Compliance score</p>
            </div>
          </div>

          {/* status rows */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between rounded-lg border border-border/30 px-3 py-2.5">
              <span className="flex items-center gap-2 text-xs font-medium text-foreground">
                <FileCheck className="h-3.5 w-3.5 text-primary" /> DBS certificates
              </span>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-secondary">
                <CheckCircle2 className="h-3 w-3" /> Up to date
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/30 px-3 py-2.5">
              <span className="flex items-center gap-2 text-xs font-medium text-foreground">
                <Users className="h-3.5 w-3.5 text-primary" /> Tonight&apos;s roster
              </span>
              <span className="text-[11px] font-semibold text-foreground">6 carers confirmed</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
              <span className="flex items-center gap-2 text-xs font-medium text-foreground">
                <Bell className="h-3.5 w-3.5 text-amber-600" /> 1 document expiring soon
              </span>
              <span className="text-[11px] font-semibold text-amber-600">Review</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
