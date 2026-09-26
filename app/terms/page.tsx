import { MarketingFooter } from "@/components/shared/marketing-footer";
import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — CareComply",
  description: "Terms and conditions for using the CareComply compliance management platform.",
};

const sections = [
  {
    title: "1. Acceptance of Terms",
    content: "By accessing or using CareComply (\"the Service\"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service. These terms apply to all users, including care organisation administrators, carers, and any other individuals who access the platform.",
  },
  {
    title: "2. Account Registration",
    content: "You must provide accurate, complete, and current information when creating an account. You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account. You must notify us immediately of any unauthorised use of your account. Each account is for a single care organisation. Multiple organisations require separate accounts.",
  },
  {
    title: "3. Subscription and Payments",
    content: "CareComply is priced at £10 per active carer per month, billed monthly via Stripe. You may cancel your subscription at any time. Upon cancellation, your access continues until the end of the current billing period. No refunds are provided for partial months. All prices are exclusive of VAT where applicable.",
  },
  {
    title: "4. Data After Cancellation",
    content: "After your subscription ends or your account is closed, your data is retained in read-only mode for 30 days to allow you to export it. After 30 days without an active subscription, your data may be permanently deleted. You may request earlier deletion by contacting us.",
  },
  {
    title: "5. Acceptable Use",
    content: "You agree not to misuse the Service. This includes, but is not limited to: uploading illegal or harmful content, attempting to access data belonging to other organisations, interfering with the security or operation of the Service, or using the Service to violate any applicable laws or regulations including the UK Data Protection Act 2018 and UK GDPR. CareComply is designed for use by registered care providers in the United Kingdom. Use outside this context must comply with equivalent local regulations.",
  },
  {
    title: "6. Data Ownership and Privacy",
    content: "You retain full ownership of all data you upload to CareComply. We do not claim any ownership over your data. We process your data solely to provide the Service. Our handling of your data is governed by our Privacy Policy and complies with the UK General Data Protection Regulation (UK GDPR). You are the data controller for personal data you process through the Service. CareComply acts as a data processor on your behalf.",
  },
  {
    title: "7. Service Availability",
    content: "We strive to maintain high availability but do not guarantee uninterrupted access. We may need to perform maintenance, updates, or address technical issues that temporarily affect availability. We will provide reasonable notice of planned maintenance where possible. In no event shall CareComply be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service.",
  },
  {
    title: "8. Intellectual Property",
    content: "The CareComply platform, including its design, code, branding, and documentation, is the intellectual property of CareComply. You may not copy, modify, distribute, or create derivative works from any part of the Service without explicit written permission.",
  },
  {
    title: "9. Termination",
    content: "We reserve the right to suspend or terminate your account if you violate these terms. Upon termination, your right to access the Service ceases immediately. We will provide a reasonable opportunity to export your data before account deletion where termination is not due to a violation of these terms.",
  },
  {
    title: "10. Changes to Terms",
    content: "We may update these Terms of Service from time to time. Material changes will be communicated via email or through the Service at least 30 days before taking effect. Continued use of the Service after changes take effect constitutes acceptance of the updated terms.",
  },
  {
    title: "11. Governing Law",
    content: "These Terms of Service are governed by and construed in accordance with the laws of England and Wales. Any disputes arising from these terms shall be subject to the exclusive jurisdiction of the courts of England and Wales.",
  },
  {
    title: "12. Contact",
    content: "For questions about these Terms of Service, contact us at legal@carecomply.co.uk.",
  },
];

export default function TermsPage() {
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
        <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
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
