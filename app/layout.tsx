import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "CareComply — CQC-Ready Compliance for Care Homes",
    template: "%s — CareComply",
  },
  description: "Clinical-grade compliance platform for care homes. Digital onboarding, document tracking, MAR charts, shift rostering, and CQC inspection evidence — all in one place.",
  keywords: ["care home compliance", "CQC", "care quality commission", "care home software", "MAR charts", "DBS tracking", "shift rostering", "care home management"],
  icons: { icon: "/favicon.svg", apple: "/icon-192.svg" },
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "CareComply" },
  openGraph: {
    title: "CareComply — CQC-Ready Compliance for Care Homes",
    description: "Digital onboarding, document tracking, MAR charts, shift rostering, and CQC inspection evidence — all in one place.",
    images: [{ url: "/og-image.svg", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image", title: "CareComply", description: "CQC-ready compliance for care homes.", images: ["/og-image.svg"] },
  other: { "theme-color": "#4F46E5", "mobile-web-app-capable": "yes", "apple-mobile-web-app-capable": "yes", "apple-mobile-web-app-status-bar-style": "black-translucent", "apple-mobile-web-app-title": "CareComply" },
  robots: { index: true, follow: true },
};

const geistSans = Geist({ variable: "--font-geist-sans", display: "swap", subsets: ["latin"] });

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.className} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <div className="animate-fade-up">{children}</div>
        </ThemeProvider>
      </body>
    </html>
  );
}
