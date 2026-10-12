import type { Metadata } from "next";
import { Roboto, Roboto_Slab } from "next/font/google";
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
  other: { "theme-color": "#4b2a78", "mobile-web-app-capable": "yes", "apple-mobile-web-app-capable": "yes", "apple-mobile-web-app-status-bar-style": "black-translucent", "apple-mobile-web-app-title": "CareComply" },
  robots: { index: true, follow: true },
};

const roboto = Roboto({ variable: "--font-roboto", weight: ["300", "400", "500", "700"], display: "swap", subsets: ["latin"] });
const robotoSlab = Roboto_Slab({ variable: "--font-roboto-slab", weight: ["300", "400", "700"], display: "swap", subsets: ["latin"] });

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${roboto.variable} ${robotoSlab.variable} font-sans antialiased`}>
        {/* Light by default (the toggle still offers dark). New storage key resets earlier "system"/dark choices. */}
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="carecomply-theme" disableTransitionOnChange>
          <div className="animate-fade-up">{children}</div>
        </ThemeProvider>
      </body>
    </html>
  );
}
