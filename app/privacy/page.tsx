import { MarketingFooter } from "@/components/shared/marketing-footer";
import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — CareComply",
  description: "How CareComply collects, uses, and protects your data. UK GDPR compliant.",
};

const sections = [
  {
    title: "1. Introduction",
    content: "CareComply (\"we\", \"our\", \"us\") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, store, and protect your personal data when you use our compliance management platform. We comply with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.",
  },
  {
    title: "2. Who We Are",
    content: "CareComply is a compliance management platform for care providers in the United Kingdom. For the purposes of UK GDPR, when you use our platform to process data about your carers, clients, and staff, you act as the Data Controller. CareComply acts as a Data Processor on your behalf. Contact: privacy@carecomply.co.uk.",
  },
  {
    title: "3. Data We Collect",
    content: "We collect the following categories of data: (a) Account information — your name, email address, organisation name, and password (hashed). (b) Carer data — as uploaded by you, including full name, email, phone number, date of birth, National Insurance number, visa status, DBS certificate details, driving licence information, bank account details, passport information, address, and next of kin details. (c) Client data — as entered by you, including full name, address, care plans, assessments, medication records, and care notes. (d) Usage data — IP address, browser type, pages visited, and actions performed within the platform for audit and security purposes.",
  },
  {
    title: "4. How We Use Your Data",
    content: "We use your data solely to provide and improve the CareComply service. Specifically: to manage your account and subscription, to provide compliance tracking features, to send notifications (e.g. document expiry alerts, shift reminders, application updates), to generate compliance reports and CQC evidence packs, to maintain audit logs for regulatory compliance, and to improve the platform based on usage patterns. We do NOT sell your data. We do NOT use your data for advertising. We do NOT train AI models on your data.",
  },
  {
    title: "5. Data Storage and Security",
    content: "Your data is stored in Supabase, a SOC 2 Type II compliant cloud database provider. Supabase hosts data in the EU (specifically, the eu-west region). All data is encrypted at rest (AES-256) and in transit (TLS 1.2+). Access to your data is strictly limited to authorised personnel who require it to maintain and support the service. Each care organisation's data is logically isolated — no organisation can access another organisation's data.",
  },
  {
    title: "6. Third-Party Sub-Processors",
    content: "We use the following third-party services to operate CareComply: (a) Supabase — database hosting, authentication, and file storage. Data stored in the EU. (b) Stripe — payment processing. Stripe is PCI DSS Level 1 compliant. (c) Resend — email delivery for notifications and alerts. All sub-processors are contractually obligated to handle your data in compliance with UK GDPR. We maintain a list of current sub-processors and will notify you of any changes.",
  },
  {
    title: "7. Data Retention",
    content: "We retain your data for as long as your account is active. After account closure or subscription expiry, your data is retained in read-only mode for 30 days to allow you to export it. After 30 days, all data associated with your organisation is permanently deleted from our systems and from our sub-processors. You may request earlier deletion by contacting us. Audit logs may be retained for up to 6 years for regulatory compliance purposes.",
  },
  {
    title: "8. Data Subject Rights (UK GDPR)",
    content: "Under UK GDPR, individuals whose data you process through CareComply have the following rights: Right of access, Right to rectification, Right to erasure, Right to restrict processing, Right to data portability, Right to object. As the Data Controller, you are responsible for responding to data subject requests. CareComply provides tools to export, update, and delete data to assist you in fulfilling these obligations. We will assist with any data subject request within 30 days as required by law.",
  },
  {
    title: "9. International Data Transfers",
    content: "Your data is primarily stored and processed within the European Economic Area (EEA). Where sub-processors operate outside the EEA, we ensure appropriate safeguards are in place, including Standard Contractual Clauses (SCCs) approved by the UK Information Commissioner's Office. Currently, all data processing occurs within the EEA through our EU-hosted Supabase instance.",
  },
  {
    title: "10. Cookies",
    content: "CareComply uses essential cookies for authentication and session management. These cookies are strictly necessary for the platform to function and do not require consent under UK GDPR. We do not use tracking cookies, analytics cookies, or advertising cookies. Your authentication session is managed through secure, HTTP-only cookies that cannot be accessed by client-side scripts.",
  },
  {
    title: "11. Data Breach Notification",
    content: "In the event of a personal data breach, we will notify the UK Information Commissioner's Office (ICO) within 72 hours of becoming aware of the breach, where required by law. We will also notify affected Data Controllers without undue delay if the breach is likely to result in a high risk to the rights and freedoms of individuals.",
  },
  {
    title: "12. Children's Data",
    content: "CareComply is not intended for use by individuals under the age of 16. We do not knowingly collect data from children. If you are a care provider using CareComply to manage data about clients under 16, you are responsible for obtaining appropriate consent as the Data Controller.",
  },
  {
    title: "13. Changes to This Policy",
    content: "We may update this Privacy Policy from time to time. Material changes will be communicated via email to account holders and through a notice on the platform at least 30 days before taking effect. The date at the top of this page indicates when the policy was last revised.",
  },
  {
    title: "14. Contact and Complaints",
    content: "For privacy-related enquiries or to exercise your rights, contact us at privacy@carecomply.co.uk. You have the right to lodge a complaint with the UK Information Commissioner's Office (ICO) at www.ico.org.uk if you believe your data has been processed unlawfully.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-gradient-to-r from-primary via-primary/95 to-primary/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center gap-3 text-lg font-bold tracking-tight text-white">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl gold-accent text-base font-bold text-primary-foreground shadow-glow">C</div>
            <span className="hidden sm:inline text-xl">CareComply</span>
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: June 2026</p>

        <div className="mt-10 space-y-10">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-semibold">{section.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{section.content}</p>
            </section>
          ))}
        </div>
      </div>

      <MarketingFooter />
    </main>
  );
}
