import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MarketingFooter } from "@/components/shared/marketing-footer";
import { TrustStrip } from "@/components/marketing/trust-strip";
import { MobileCtaBar } from "@/components/marketing/mobile-cta-bar";
import {
  Shield, ArrowRight, CheckCircle2, Heart, Sparkles, Pill, CalendarClock, BarChart3,
} from "lucide-react";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "CareComply",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: "Clinical-grade compliance platform for care homes. Digital onboarding, document tracking, MAR charts, shift rostering, and CQC inspection evidence — all in one place.",
  offers: { "@type": "Offer", price: "10.00", priceCurrency: "GBP", priceValidUntil: "2027-12-31" },
};

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Header */}
      <header className="absolute inset-x-0 top-0 z-50 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <span className="flex items-center gap-2 text-lg font-bold tracking-tight sm:gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white text-base font-bold text-primary shadow-card sm:h-10 sm:w-10">C</div>
            <span className="text-base sm:text-xl">CareComply</span>
          </span>
          <nav aria-label="Primary" className="flex items-center gap-2 sm:gap-3">
            <div className="mr-2 hidden items-center gap-6 md:flex">
              <a href="#solution" className="text-sm font-medium text-white/85 transition-colors hover:text-white">Features</a>
              <a href="#pricing" className="text-sm font-medium text-white/85 transition-colors hover:text-white">Pricing</a>
            </div>
            <Link href="/auth/login"><Button variant="ghost" className="h-9 px-2.5 text-white hover:bg-white/10 hover:text-white sm:px-4">Sign In</Button></Link>
            <Link href="/auth/sign-up"><Button className="h-10 rounded-full gradient-indigo px-4 text-white hover:opacity-90 sm:px-6">Get Started</Button></Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section id="hero" className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-hero" />
                <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-32 pt-32 sm:pb-40 sm:pt-40 lg:grid-cols-2">
          <div className="text-center lg:text-left">
            <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-glow-primary animate-float lg:mx-0">
              <Sparkles className="h-8 w-8 text-white" aria-hidden="true" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl leading-[1.1] text-white">
              Your carers deserve better than{" "}
              <span className="text-pink-300">paper and panic</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl font-serif text-base font-light leading-relaxed text-white/90 sm:text-lg lg:mx-0">
              CareComply keeps you inspection-ready, so you can focus on care, not compliance.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4 lg:justify-start">
              <Link href="/auth/sign-up">
                <Button size="lg" className="rounded-xl px-8 gradient-indigo text-white hover:opacity-90 shadow-glow-primary text-base h-12">
                  <span className="font-semibold">Get Started Free</span> <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
              <Link href="/cqc">
                <Button variant="outline" size="lg" className="rounded-xl px-8 bg-transparent border-white/30 text-white hover:bg-white/10 h-12">
                  See CQC alignment
                </Button>
              </Link>
            </div>
            <div className="mt-8 flex justify-center gap-6 text-xs text-white/80 lg:justify-start">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-pink-300" aria-hidden="true" />No credit card</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-pink-300" aria-hidden="true" />Cancel anytime</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-pink-300" aria-hidden="true" />CQC-ready</span>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-md lg:mx-0 lg:ml-auto">
            <div className="absolute -inset-3 rounded-md bg-white/10 blur-xl" aria-hidden="true" />
            <Image
              src="/images/hero-care.jpg"
              alt="A smiling carer holding hands with an older woman"
              width={612}
              height={408}
              priority
              sizes="(min-width: 1024px) 448px, 100vw"
              className="relative h-auto w-full rounded-md shadow-elevated"
            />
          </div>
        </div>
      </section>

      <div className="relative z-10 mx-auto -mt-20 max-w-6xl overflow-hidden rounded-md bg-card shadow-elevated">
      <TrustStrip />

      {/* The Solution */}
      <section id="solution" className="border-t border-border/40 bg-gradient-to-b from-muted/30 to-transparent py-28 sm:py-32">
        <div className="mx-auto max-w-4xl px-4">
          <div className="mb-14 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-secondary">The Solution</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">One platform. Total peace of mind.</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {[
              { icon: Shield, title: "Document Compliance", desc: "Upload DBS, passport, visa, driving licence. Auto-calculated status. Email alerts before expiry.", gradient: "from-primary/10 to-accent/5", iconBg: "bg-primary/10", iconColor: "text-primary" },
              { icon: CalendarClock, title: "Shift Rostering", desc: "Schedule recurring shifts. Conflict detection. Carers see their roster on mobile.", gradient: "from-secondary/10 to-mint/5", iconBg: "bg-secondary/10", iconColor: "text-secondary" },
              { icon: Pill, title: "Digital MAR Charts", desc: "Replace paper medication records. Log each administration with one tap.", gradient: "from-gold/10 to-amber-500/5", iconBg: "bg-gold/10", iconColor: "text-gold" },
              { icon: BarChart3, title: "CQC Evidence Dashboard", desc: "Real-time compliance score. One-click inspection evidence pack.", gradient: "from-secondary/10 to-accent/5", iconBg: "bg-secondary/10", iconColor: "text-secondary" },
            ].map((item) => (
              <Card key={item.title} className={`rounded-2xl border-border/40 bg-gradient-to-br ${item.gradient} shadow-card hover:shadow-card-hover transition-all duration-300`}>
                <CardContent className="p-6">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.iconBg}`}>
                    <item.icon className={`h-5 w-5 ${item.iconColor}`} aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 font-semibold text-lg">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-border/40 bg-gradient-to-b from-muted/20 to-transparent py-28 sm:py-32">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Simple, transparent pricing</h2>
          <p className="mt-3 text-muted-foreground">One plan. Pay only for the carers you manage.</p>
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
                    "CQC evidence dashboard",
                    "Cancel anytime",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-secondary mt-0.5 shrink-0" aria-hidden="true" />
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

      </div>

      {/* CTA */}
      <section id="final-cta" className="relative mt-20 overflow-hidden py-28 sm:py-32">
        <div className="absolute inset-0 gradient-hero" />
        <div className="relative mx-auto max-w-2xl px-4 text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-glow-primary">
            <Heart className="h-7 w-7 text-white" aria-hidden="true" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-white">Ready to stop worrying about compliance?</h2>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/auth/sign-up">
              <Button size="lg" className="rounded-xl px-8 gradient-indigo text-white hover:opacity-90 shadow-glow-primary text-base h-12">
                <span className="font-semibold">Get Started Free</span> <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
            <Link href="/cqc">
              <Button variant="outline" size="lg" className="rounded-xl px-8 bg-transparent border-white/30 text-white hover:bg-white/10 h-12">
                CQC alignment guide
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
      <MobileCtaBar heroId="hero" hideNearId="final-cta" />
    </main>
  );
}
