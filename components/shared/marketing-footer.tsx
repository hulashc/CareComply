import Link from "next/link";

const footerLinks = [
  { label: "CQC Alignment", href: "/cqc" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Contact", href: "mailto:hello@carecomply.co.uk" },
];

export function MarketingFooter() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          <div className="flex flex-col items-center gap-1 sm:items-start">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">C</div>
              <span className="text-sm font-semibold tracking-tight">CareComply</span>
            </div>
            <p className="text-xs text-muted-foreground">Built for care providers in the UK.</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {footerLinks.map((link) => (
              <Link key={link.href} href={link.href} className="text-xs text-muted-foreground transition-colors hover:text-foreground">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="mt-8 border-t pt-6 text-center">
          <p className="text-[11px] text-muted-foreground">
            &copy; 2026 CareComply. All rights reserved. CareComply is not affiliated with the Care Quality Commission.
          </p>
        </div>
      </div>
    </footer>
  );
}
