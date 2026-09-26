import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MarketingFooter } from "@/components/shared/marketing-footer";
import {
  Shield, FileCheck, Users, ArrowRight, CheckCircle2, Heart, Sparkles,
  AlertTriangle, Clock, Pill, ClipboardList, CalendarClock, BarChart3,
  MessageSquare, Search, Smartphone
} from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <span className="flex items-center gap-3 text-lg font-bold tracking-tight">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-base font-bold text-white shadow-glow-primary">C</div>
            <span className="text-xl">CareComply</span>
          </span>
          <div className="flex items-center gap-3">
            <Link href="/auth/login"><Button variant="ghost" className="rounded-xl text-sm h-9 px-4">Sign In</Button></Link>
            <Link href="/auth/sign-up"><Button className="rounded-xl gradient-indigo text-white hover:opacity-90 shadow-glow-primary h-9 px-5 text-sm font-medium">Get Started</Button></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-hero" />
        <div className="absolute inset-0 gradient-mesh opacity-60" />
        <div className="relative mx-auto max-w-4xl px-4 py-24 text-center sm:py-36">
          <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-glow-primary animate-float">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl leading-[1.1] text-white">
            Your carers deserve better than{" "}
            <span className="bg-gradient-to-r from-secondary to-accent bg-clip-text text-transparent">paper and panic</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/60 sm:text-lg">
            DBS checks expiring. Shift handovers on wet post-it notes. CQC inspection tomorrow and you cannot find the file.
            <span className="block mt-3 font-medium text-white/80">CareComply keeps you inspection-ready so you can focus on care, not compliance.</span>
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Link href="/auth/sign-up">
              <Button size="lg" className="rounded-xl px-8 gradient-indigo text-white hover:opacity-90 shadow-glow-primary text-base h-12">
                <span className="font-semibold">Get Started Free</span> <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/cqc">
              <Button variant="outline" size="lg" className="rounded-xl px-8 border-white/20 text-white hover:bg-white/10 h-12">
                See CQC alignment
              </Button>
            </Link>
          </div>
          <div className="mt-8 flex justify-center gap-6 text-xs text-white/50">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-secondary" />No credit card</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-secondary" />Cancel anytime</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-secondary" />CQC-ready</span>
          </div>
        </div>
      </section>

      {/* Pain Points */}
      <section className="mx-auto max-w-5xl px-4 py-20 sm:py-24">
        <div className="mb-14 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">The Problem</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Does this sound familiar?</h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          {[
            { icon: Search, title: "Where is that document?", desc: "CQC inspector asks for a carer's DBS certificate. You scramble through filing cabinets while your heart races.", color: "from-red-500/10 to-red-500/5", border: "border-red-500/20", iconBg: "bg-red-100 dark:bg-red-950/40", iconColor: "text-red-600 dark:text-red-400" },
            { icon: Clock, title: "Who is working tonight?", desc: "The roster is on a whiteboard that someone wiped clean. You call round at 7pm hoping someone picks up.", color: "from-amber-500/10 to-amber-500/5", border: "border-amber-500/20", iconBg: "bg-amber-100 dark:bg-amber-950/40", iconColor: "text-amber-600 dark:text-amber-400" },
            { icon: AlertTriangle, title: "Did the morning shift know?", desc: "A resident was unsettled overnight. The night carer left a note but the morning carer never saw it.", color: "from-blue-500/10 to-blue-500/5", border: "border-blue-500/20", iconBg: "bg-blue-100 dark:bg-blue-950/40", iconColor: "text-blue-600 dark:text-blue-400" },
          ].map((item) => (
            <Card key={item.title} className={`rounded-2xl border ${item.border} bg-gradient-to-br ${item.color} shadow-card hover:shadow-card-hover transition-all duration-300`}>
              <CardContent className="p-6">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.iconBg}`}>
                  <item.icon className={`h-5 w-5 ${item.iconColor}`} />
                </div>
                <h3 className="mt-4 font-semibold text-lg">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* The Solution */}
      <section className="border-t border-border/40 bg-gradient-to-b from-muted/30 to-transparent py-20 sm:py-24">
        <div className="mx-auto max-w-5xl px-4">
          <div className="mb-14 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-secondary">The Solution</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">One platform. Total peace of mind.</h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Every compliance task your care home faces — documents, shifts, medications, handovers, inspections — in one place.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Shield, title: "Document Compliance", desc: "Upload DBS, passport, visa, driving licence. Auto-calculated status. Email alerts before expiry.", gradient: "from-primary/10 to-accent/5", iconBg: "bg-primary/10", iconColor: "text-primary" },
              { icon: CalendarClock, title: "Shift Rostering", desc: "Schedule recurring shifts. Conflict detection. Week/month views. Carers see their roster on mobile.", gradient: "from-secondary/10 to-mint/5", iconBg: "bg-secondary/10", iconColor: "text-secondary" },
              { icon: Pill, title: "Digital MAR Charts", desc: "Replace paper medication records. Log each administration with one tap. Exportable for inspectors.", gradient: "from-gold/10 to-amber-500/5", iconBg: "bg-gold/10", iconColor: "text-gold" },
              { icon: ClipboardList, title: "Carer Onboarding", desc: "Send secure application links. Carers fill forms, upload documents online. Auto-create accounts on approval.", gradient: "from-primary/10 to-secondary/5", iconBg: "bg-primary/10", iconColor: "text-primary" },
              { icon: MessageSquare, title: "Shift Handovers", desc: "Structured handover notes with read receipts. Morning shift sees exactly what night shift reported.", gradient: "from-accent/10 to-primary/5", iconBg: "bg-accent/10", iconColor: "text-accent" },
              { icon: BarChart3, title: "CQC Evidence Dashboard", desc: "Real-time compliance score. Incident trends. One-click inspection evidence pack.", gradient: "from-secondary/10 to-accent/5", iconBg: "bg-secondary/10", iconColor: "text-secondary" },
            ].map((item) => (
              <Card key={item.title} className={`rounded-2xl border-border/40 bg-gradient-to-br ${item.gradient} shadow-card hover:shadow-card-hover transition-all duration-300`}>
                <CardContent className="p-6">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.iconBg}`}>
                    <item.icon className={`h-5 w-5 ${item.iconColor}`} />
                  </div>
                  <h3 className="mt-4 font-semibold text-lg">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-4xl px-4">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">How it works</h2>
            <p className="mt-3 text-muted-foreground">Get started in under two minutes.</p>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            {[
              { step: "1", title: "Create your account", desc: "Sign up in 30 seconds. No credit card needed." },
              { step: "2", title: "Invite your carers", desc: "Send secure links. They upload documents from their phones." },
              { step: "3", title: "Stay CQC-ready", desc: "Dashboards and alerts keep you inspection-ready every day." },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-xl font-bold text-white shadow-glow-primary">{item.step}</div>
                <h3 className="mt-5 font-semibold text-lg">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CQC Mastery */}
      <section className="border-t border-border/40 py-20 sm:py-24">
        <div className="mx-auto max-w-5xl px-4">
          <div className="flex flex-col items-start gap-8 sm:flex-row sm:items-center">
            <div className="flex-shrink-0">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-accent/10">
                <Shield className="h-8 w-8 text-primary" />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">CQC Mastery</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Mapped to every KLOE.</h2>
              <p className="mt-3 text-muted-foreground max-w-2xl">
                CareComply is designed around the CQC&apos;s 5 Key Lines of Enquiry — Safe, Effective, Caring, Responsive, and Well-led.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {["Safe", "Effective", "Caring", "Responsive", "Well-led"].map((kloe) => (
                  <span key={kloe} className="rounded-xl bg-primary/10 border border-primary/20 px-3 py-1.5 text-xs font-semibold text-primary">{kloe}</span>
                ))}
              </div>
              <div className="mt-5">
                <Link href="/cqc">
                  <Button variant="outline" size="sm" className="rounded-xl gap-1.5 border-primary/20 text-primary hover:bg-primary/5">
                    View full CQC alignment <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="border-t border-border/40 bg-gradient-to-b from-muted/20 to-transparent py-20 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Simple, transparent pricing</h2>
          <p className="mt-3 text-muted-foreground">One plan. All features. Pay only for the carers you manage.</p>
          <div className="mx-auto mt-12 max-w-sm">
            <Card className="rounded-3xl border-2 border-primary/30 shadow-glow-primary overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-primary via-accent to-secondary" />
              <CardContent className="p-8 text-center">
                <p className="text-sm font-semibold uppercase tracking-wider text-primary">Per Carer</p>
                <div className="mt-4">
                  <span className="text-6xl font-bold tracking-tight">&pound;10</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">per carer, billed monthly</p>
                <ul className="mt-8 space-y-3 text-left">
                  {[
                    "No credit card required to start",
                    "Unlimited clients & documents",
                    "Mobile carer portal included",
                    "CQC evidence dashboard",
                    "Email alerts & notifications",
                    "Cancel anytime",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-secondary mt-0.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/auth/sign-up" className="mt-8 block">
                  <Button size="lg" className="w-full rounded-xl gradient-indigo text-white hover:opacity-90 shadow-glow-primary h-12 text-base font-medium">
                    Get Started Free <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border/40 py-20 sm:py-24">
        <div className="mx-auto max-w-3xl px-4">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Frequently asked questions</h2>
          </div>
          <div className="space-y-4">
            {[
              { q: "Is my data secure?", a: "Yes. Your data is stored in Supabase, a SOC 2 compliant database provider with encryption at rest and in transit. Each care organisation's data is fully isolated. We are UK GDPR compliant." },
              { q: "What if I manage 50 or more carers?", a: "CareComply scales with you. There is no upper limit. Each carer has their own portal login. You manage everything from a single admin dashboard. Pricing stays at £10 per carer per month." },
              { q: "Can carers use this on their phones?", a: "Absolutely. The carer portal is fully mobile-responsive and works as a Progressive Web App (PWA). Carers can view shifts, complete tasks, log medications, and write handover notes from any smartphone." },
              { q: "How does the subscription work?", a: "Subscribe at £10 per carer per month. You only pay for the carers you manage. Cancel anytime. Your data remains accessible for 30 days after cancellation so you can export what you need." },
              { q: "Does this replace paper MAR charts?", a: "Yes. CareComply includes digital Medication Administration Records (MAR). Log each administration, track who gave what and when, and generate exportable reports for CQC inspections." },
              { q: "Can I export data for CQC inspections?", a: "Yes. The compliance dashboard includes a one-click evidence pack export covering document compliance, incident history, medication logs, care plans, and shift records." },
            ].map((item) => (
              <details key={item.q} className="group rounded-2xl border border-border/40 bg-card/50 backdrop-blur-sm">
                <summary className="flex cursor-pointer items-center justify-between px-6 py-4 text-sm font-medium">
                  {item.q}
                  <span className="ml-4 text-muted-foreground transition-transform group-open:rotate-45 text-lg">+</span>
                </summary>
                <p className="px-6 pb-4 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden py-20 sm:py-24">
        <div className="absolute inset-0 gradient-hero opacity-60" />
        <div className="relative mx-auto max-w-2xl px-4 text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-glow-primary">
            <Heart className="h-7 w-7 text-white" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-white">Ready to stop worrying about compliance?</h2>
          <p className="mt-3 text-white/60">Join care providers who are already using CareComply to stay CQC-ready every day.</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/auth/sign-up">
              <Button size="lg" className="rounded-xl px-8 gradient-indigo text-white hover:opacity-90 shadow-glow-primary h-12 text-base">
                <span className="font-semibold">Get Started Free</span> <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/cqc">
              <Button variant="outline" size="lg" className="rounded-xl px-8 border-white/20 text-white hover:bg-white/10 h-12">
                CQC alignment guide
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
