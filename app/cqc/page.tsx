import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MarketingFooter } from "@/components/shared/marketing-footer";
import { Badge } from "@/components/ui/badge";
import { Metadata } from "next";
import {
  Shield, Heart, Users, BarChart3, MessageSquare, ArrowRight,
  FileCheck, ClipboardList, Pill, CalendarClock, Download, ArrowLeft
} from "lucide-react";

export const metadata: Metadata = {
  title: "CQC Compliance Alignment — CareComply",
  description: "How CareComply maps to every CQC Key Line of Enquiry — Safe, Effective, Caring, Responsive, and Well-led. Stay inspection-ready.",
};

const kloes = [
  {
    key: "Safe",
    icon: Shield,
    color: "bg-blue-50 text-blue-700 border-blue-200",
    regulation: "Regulation 12: Safe care and treatment",
    inspectorLooksFor: "CQC inspectors check that care and treatment is provided in a safe way. They look for: safeguarding procedures, medication management, incident reporting, and staff suitability checks including DBS.",
    howCareComplyDelivers: [
      { feature: "Incident Reporting", detail: "Log incidents with severity levels and categories. Track open incidents until resolution. Generate trend reports for inspectors." },
      { feature: "Digital MAR Charts", detail: "Replace paper medication records. Log each administration with timestamps. Export medication history per client for inspection evidence." },
      { feature: "Document Verification", detail: "Track DBS certificates, visas, and professional qualifications. Auto-calculated expiry status. Email alerts before renewal deadlines." },
      { feature: "Audit Trail", detail: "Every action — who logged medication, who reported an incident, who approved a carer — is permanently recorded with timestamps." },
    ],
  },
  {
    key: "Effective",
    icon: ClipboardList,
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    regulation: "Regulation 17: Good governance",
    inspectorLooksFor: "Inspectors assess whether care and treatment reflects evidence-based practice. They look for: personalised care plans, regular assessments, outcome tracking, and how the service learns from incidents.",
    howCareComplyDelivers: [
      { feature: "Care Plans", detail: "Create and maintain digital care plans per client. Track goals, interventions, and review dates. Carers access latest plans from their phones." },
      { feature: "Client Assessments", detail: "Conduct structured assessments with scoring. Record observations and next review dates. Demonstrate evidence-based care to inspectors." },
      { feature: "Incident Learning", detail: "Every incident is tracked from report to resolution. Categorise, assign severity, and document actions taken — showing CQC your service learns and improves." },
      { feature: "Task Management", detail: "Assign tasks to carers with priorities and due dates. Track completion rates. Show inspectors that care tasks are systematically managed." },
    ],
  },
  {
    key: "Caring",
    icon: Heart,
    color: "bg-pink-50 text-pink-700 border-pink-200",
    regulation: "Regulation 9: Person-centred care",
    inspectorLooksFor: "CQC evaluates whether people are treated with compassion, dignity, and respect. They look at: how care is personalised, emotional support provided, and whether staff understand individual needs.",
    howCareComplyDelivers: [
      { feature: "Care Notes with Voice Input", detail: "Carers record observations about residents' wellbeing using voice input. Capture mood, nutrition, and fluid intake for holistic care records." },
      { feature: "Mood Tracking", detail: "Log resident mood alongside care notes. Track patterns over time. Spot changes early — show inspectors you know your residents as individuals." },
      { feature: "Handover Notes with Context", detail: "Structured shift handovers include mood, concerns, and tasks remaining. The next shift knows each resident's state — not just their medical needs." },
    ],
  },
  {
    key: "Responsive",
    icon: MessageSquare,
    color: "bg-amber-50 text-amber-700 border-amber-200",
    regulation: "Regulation 17: Good governance",
    inspectorLooksFor: "Inspectors check that the service responds to people's needs in a timely manner. This includes: complaint handling, adapting to changing needs, and communication between shifts.",
    howCareComplyDelivers: [
      { feature: "Real-time Handovers", detail: "Shift handovers with read receipts. Morning staff see exactly what the night team reported. Nothing gets lost between shifts." },
      { feature: "Shift Rostering", detail: "Schedule carers with conflict detection. See who is working now, next, and gaps to fill. Ensure staffing levels meet resident needs at all times." },
      { feature: "Incident Response Tracking", detail: "Every incident from report to resolution. Timestamps show response times. Demonstrate to CQC that issues are dealt with promptly." },
      { feature: "Absence Management", detail: "Track carer sick leave and absences. Identify patterns. Ensure safe staffing levels are maintained when people are off." },
    ],
  },
  {
    key: "Well-led",
    icon: BarChart3,
    color: "bg-purple-50 text-purple-700 border-purple-200",
    regulation: "Regulation 17: Good governance",
    inspectorLooksFor: "CQC assess leadership, management, and governance. They look for: quality assurance systems, audit processes, staff training compliance, and how the registered manager oversees the service.",
    howCareComplyDelivers: [
      { feature: "Compliance Dashboard", detail: "Real-time compliance score. Document status breakdown (compliant/expiring/expired). CQC readiness checklist. Everything a registered manager needs at a glance." },
      { feature: "Staff Compliance Scoring", detail: "Each carer gets a compliance score based on their documents. Instantly see who is fully compliant and who needs to update their DBS or training certificate." },
      { feature: "Analytics & Trends", detail: "Incident frequency charts. Mood distribution across clients. Document expiry forecasts. Data-driven governance for CQC's evidence requirements." },
      { feature: "One-click Evidence Pack", detail: "Generate a comprehensive CQC evidence pack for inspection. Includes document compliance, incident history, care plans, medication logs, and audit trail." },
    ],
  },
];

const regulations = [
  { reg: "Regulation 12", name: "Safe care and treatment", features: "Incident reporting, MAR charts, DBS tracking, safeguarding logs" },
  { reg: "Regulation 17", name: "Good governance", features: "Compliance dashboard, audit logs, CQC readiness checklist, analytics" },
  { reg: "Regulation 18", name: "Staffing", features: "Shift rostering, carer compliance scoring, absence management, qualification tracking" },
  { reg: "Regulation 19", name: "Fit and proper persons employed", features: "Digital applications, DBS verification, document verification with expiry alerts" },
  { reg: "Regulation 9", name: "Person-centred care", features: "Care plans, assessments, care notes with mood tracking, personalised task assignment" },
  { reg: "Regulation 16", name: "Receiving and acting on complaints", features: "Incident tracking with resolution workflow, audit trail of actions taken" },
];

export default function CqcPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-gradient-to-r from-primary via-primary/95 to-primary/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <span className="flex items-center gap-3 text-lg font-bold tracking-tight text-white">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl gold-accent text-base font-bold text-primary-foreground shadow-glow">C</div>
            <span className="hidden sm:inline text-xl">CareComply</span>
          </span>
          <div className="flex items-center gap-2">
            <Link href="/auth/login"><Button variant="ghost" className="rounded-lg text-white/70 hover:text-white hover:bg-white/10 h-9 px-4">Sign In</Button></Link>
            <Link href="/auth/sign-up"><Button className="rounded-lg bg-white/15 text-white hover:bg-white/25 h-9 px-4">Get Started</Button></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-4 py-20 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          CQC Compliance, <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Not Chaos</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          CareComply is designed around the CQC&apos;s regulatory framework. Every feature generates the exact evidence inspectors look for during assessments.
        </p>
        <div className="mt-8">
          <Link href="/auth/sign-up">
            <Button size="lg" className="rounded-xl gold-accent hover:brightness-110 shadow-glow">
              Get started free <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* The Five KLOEs */}
      <section className="mx-auto max-w-5xl px-4 pb-20">
        <div className="mb-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">CQC Framework</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight">The 5 Key Lines of Enquiry</h2>
          <p className="mt-2 text-sm text-muted-foreground">How CareComply maps to each KLOE</p>
        </div>

        <div className="space-y-8">
          {kloes.map((kloe) => (
            <section key={kloe.key}>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${kloe.color.split(" ")[0]}`}>
                  <kloe.icon className={`h-5 w-5 ${kloe.color.split(" ")[1]}`} />
                </div>
                <h3 className="text-xl font-bold">{kloe.key}</h3>
                <Badge variant="outline" className="rounded-md text-[11px]">{kloe.regulation}</Badge>
              </div>

              <div className="mb-6 rounded-xl border border-border/50 bg-muted/20 p-5">
                <p className="text-sm font-medium text-foreground">What inspectors look for:</p>
                <p className="mt-1 text-sm text-muted-foreground">{kloe.inspectorLooksFor}</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {kloe.howCareComplyDelivers.map((item) => (
                  <Card key={item.feature} className="rounded-xl border border-border/50 shadow-card bg-white/70">
                    <CardContent className="p-5">
                      <h4 className="text-sm font-semibold text-primary">{item.feature}</h4>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.detail}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      {/* Regulations Mapped */}
      <section className="border-t bg-muted/20 py-20">
        <div className="mx-auto max-w-5xl px-4">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold tracking-tight">CQC Regulations Mapped</h2>
            <p className="mt-2 text-sm text-muted-foreground">Key Health and Social Care Act regulations that CareComply supports</p>
          </div>
          <div className="overflow-hidden rounded-xl border border-border/50">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Regulation</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">CareComply Features</th>
                </tr>
              </thead>
              <tbody>
                {regulations.map((r) => (
                  <tr key={r.reg} className="border-b last:border-0 bg-white/50">
                    <td className="px-5 py-3.5 font-semibold text-primary">{r.reg}</td>
                    <td className="px-5 py-3.5">{r.name}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{r.features}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Inspection Evidence Pack */}
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/10">
            <Download className="h-7 w-7 text-gold" />
          </div>
          <h2 className="mt-5 text-2xl font-bold tracking-tight">One-click CQC Evidence Pack</h2>
          <p className="mt-3 text-muted-foreground">
            When an inspection is announced, generate a complete evidence pack from your compliance dashboard.
            Includes document compliance status, incident history, medication logs, care plans, shift records,
            and audit trail — everything CQC expects to see in one export.
          </p>
          <div className="mt-6 flex justify-center">
            <Link href="/auth/sign-up">
              <Button size="lg" className="rounded-xl gold-accent hover:brightness-110 shadow-glow">
                Start preparing for your next inspection <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
