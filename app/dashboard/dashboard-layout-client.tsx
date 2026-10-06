"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { NotificationBell } from "@/components/shared/notification-bell";
import { CommandPalette } from "@/components/shared/command-palette";
import { KeyboardShortcuts } from "@/components/shared/keyboard-shortcuts";
import { createClient } from "@/lib/supabase/client";
import { useSubscription } from "@/components/shared/subscription-guard";
import { WelcomeChecklist } from "@/components/shared/welcome-checklist";
import {
  LayoutDashboard, Users, Heart, CalendarClock,
  Plus, Settings, MessageSquare, CalendarX,
  BarChart3, LogOut, Sun, Moon, CreditCard, X, CheckCircle2,
  MapPin, Shield, Menu, MoreHorizontal,
} from "lucide-react";

const primaryNav = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Clients", href: "/dashboard/clients", icon: Heart },
  { label: "Carers", href: "/dashboard/carers", icon: Users },
  { label: "Shifts", href: "/dashboard/shifts", icon: CalendarClock },
  { label: "Compliance", href: "/dashboard/compliance", icon: Shield },
  { label: "Handovers", href: "/dashboard/handovers", icon: MessageSquare },
  { label: "Locations", href: "/dashboard/locations", icon: MapPin },
];

const SECTION_TITLES: Record<string, string> = {
  add: "Quick Add", "add-carer": "Add Carer", "add-document": "Add Document", "invite-carer": "Invite Carer",
  cqc: "CQC Evidence", incidents: "Incidents", notes: "Care Notes", tasks: "Tasks",
};
function sectionTitle(pathname: string) {
  const seg = pathname.split("/")[2];
  if (!seg) return "Dashboard";
  return SECTION_TITLES[seg] ?? seg.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
}

const moreNav = [
  { label: "Absences", href: "/dashboard/absences", icon: CalendarX },
  { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
];

function UserMenu() {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [initials, setInitials] = useState("?");
  const [name, setName] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: admin } = await supabase.from("admins").select("full_name").eq("id", user.id).single();
      const fullName = admin?.full_name || user.email || "";
      setName(fullName);
      const parts = fullName.split(" ").filter(Boolean);
      setInitials(parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : (parts[0]?.[0] || "?").toUpperCase());
    }
    load();
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-3 rounded-xl p-1.5 text-left transition-colors hover:bg-white/10" aria-label="Open user menu">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-fuchsia-600 text-sm font-bold text-white shadow-sm">
            {initials}
          </div>
          <div className="hidden min-w-0 2xl:block">
            <p className="max-w-[140px] truncate text-sm font-medium text-white">{name}</p>
            <p className="text-[11px] text-white/60">Admin</p>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 rounded-xl p-2">
        <DropdownMenuLabel className="text-[10px] font-semibold uppercase text-muted-foreground px-3 py-1.5">Account</DropdownMenuLabel>
        <DropdownMenuItem asChild className="rounded-lg"><Link href="/dashboard/settings" className="flex items-center gap-2.5 px-3 py-2 text-sm"><Settings className="h-4 w-4" />Settings</Link></DropdownMenuItem>
        <DropdownMenuItem className="rounded-lg flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {theme === "dark" ? "Light Mode" : "Dark Mode"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="rounded-lg flex items-center gap-2.5 px-3 py-2 text-sm text-destructive cursor-pointer" onClick={signOut}><LogOut className="h-4 w-4" />Sign Out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function DashboardLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
  const sub = useSubscription();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // The header is transparent over the purple band, then turns solid once the page scrolls.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const searchParams = useSearchParams();
  const justSubscribed = typeof window !== "undefined" ? sessionStorage.getItem("just_subscribed") === "true" : false;
  const showWelcome = (searchParams.get("welcome") === "subscribed" || justSubscribed) && !welcomeDismissed && !sub.loading && sub.status === "active";

  function dismissWelcome() {
    setWelcomeDismissed(true);
    if (typeof window !== "undefined") sessionStorage.removeItem("just_subscribed");
  }

  const tabClass = (active: boolean) => cn(
    "flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium whitespace-nowrap transition-all",
    active
      ? "bg-white/15 text-white shadow-sm border border-white/25"
      : "border border-transparent text-white/80 hover:text-white hover:bg-white/10"
  );
  const moreActive = moreNav.some((i) => isActive(i.href));

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      {/* Purple hero band behind the header and page title */}
      <div className="hero-bg absolute inset-x-0 top-0 h-80 overflow-hidden" aria-hidden="true">
        <Image src="/images/hero-care.jpg" alt="" fill priority sizes="100vw" className="object-cover object-[50%_32%] opacity-60" />
        {/* Purple wash: strongest behind the title on the left, lets the photo glow through on the right. */}
        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--hero-from))]/95 via-[hsl(var(--hero-mid))]/60 to-[hsl(var(--hero-to))]/25" />
        {/* Soft fade into the page below. */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/20 to-transparent" />
      </div>

      {/* Top navigation */}
      <header className={cn(
        "sticky top-0 z-50 text-white transition-colors duration-200",
        scrolled ? "bg-[hsl(var(--hero-from))]/95 shadow-sidebar backdrop-blur-md" : "bg-transparent"
      )}>
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white text-base font-bold text-primary shadow-card">C</div>
            <span className="text-lg font-bold tracking-tight">CareComply</span>
          </Link>

          {/* Tabs (large screens) */}
          <nav className="ml-4 hidden min-w-0 flex-1 items-center gap-1 xl:flex" aria-label="Main">
            {primaryNav.map((item) => (
              <Link key={item.href} href={item.href} className={tabClass(isActive(item.href))} aria-current={isActive(item.href) ? "page" : undefined}>
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            ))}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={tabClass(moreActive)} aria-label="More pages">
                  <MoreHorizontal className="h-4 w-4" />
                  <span>More</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44 rounded-xl p-2">
                {moreNav.map((item) => (
                  <DropdownMenuItem key={item.href} asChild className="rounded-lg">
                    <Link href={item.href} className="flex items-center gap-2.5 px-3 py-2 text-sm"><item.icon className="h-4 w-4" />{item.label}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link href="/dashboard/add" className="hidden sm:block">
              <Button size="sm" className="rounded-full bg-white text-primary shadow-button hover:bg-white/90 gap-1.5">
                <Plus className="h-4 w-4" />Quick Add
              </Button>
            </Link>
            <NotificationBell />
            <UserMenu />
            <button
              onClick={() => setMobileOpen((o) => !o)}
              className="rounded-lg p-2 hover:bg-white/10 transition-colors xl:hidden"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Dropdown panel (small screens) */}
        {mobileOpen && (
          <nav className="border-t border-white/10 px-4 pb-4 pt-2 xl:hidden" aria-label="Main">
            <div className="grid gap-1 sm:grid-cols-2">
              {[...primaryNav, { label: "Quick Add", href: "/dashboard/add", icon: Plus }, ...moreNav].map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={tabClass(isActive(item.href))}>
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </nav>
        )}
      </header>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Subscription banners */}
        {showWelcome && sub.seatsPurchased > 0 && (
          <WelcomeChecklist seatsPurchased={sub.seatsPurchased} carerCount={sub.carerCount} onDismiss={dismissWelcome} />
        )}
        {!sub.loading && sub.status === "active" && sub.seatsPurchased > 0 && !showWelcome && pathname !== "/dashboard/onboarding" && (
          <div className="bg-gradient-to-r from-emerald-50/80 via-emerald-50/40 to-emerald-50/80 dark:from-emerald-950/10 dark:via-emerald-950/5 dark:to-emerald-950/10 border-b">
            <div className="flex items-center justify-between px-6 py-2.5">
              <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{sub.seatsPurchased} seat{sub.seatsPurchased !== 1 ? "s" : ""} active · £{sub.seatsPurchased * 10}/month</span>
              </div>
              <Link href="/dashboard/settings/billing">
                <Button variant="ghost" size="sm" className="h-7 rounded-lg text-[11px] text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100">Manage</Button>
              </Link>
            </div>
          </div>
        )}
        {!sub.loading && sub.status !== "active" && !sub.dismissed && pathname !== "/dashboard/onboarding" && (
          <div className="bg-gradient-to-r from-gold/10 via-amber-50/50 to-gold/10 dark:from-gold/5 dark:via-amber-950/20 dark:to-gold/5 border-b">
            <div className="flex items-center justify-between px-6 py-3">
              <div className="flex items-center gap-3 text-sm">
                <CreditCard className="h-4 w-4 text-gold" />
                <span className="font-medium">
                  {sub.carerCount > 0
                    ? `You are managing ${sub.carerCount} carer${sub.carerCount > 1 ? "s" : ""}. Subscribe to unlock full compliance tracking.`
                    : "Welcome to CareComply! Subscribe when you are ready to manage your team."}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/dashboard/settings/billing">
                  <Button size="sm" className="rounded-lg gold-accent hover:brightness-110 text-xs">Subscribe</Button>
                </Link>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={sub.dismiss}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Page title on the purple band */}
        <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-28 pt-6 text-white sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight">{sectionTitle(pathname)}</h1>
        </div>

        {/* Page content: white elevated card overlapping the band */}
        <main className="relative z-10 mx-auto -mt-20 w-full max-w-7xl flex-1 px-4 pb-10 sm:px-6 lg:px-8">
          <div key={pathname} className="material-card min-h-[50vh] animate-fade-up p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>

      <CommandPalette /><KeyboardShortcuts />
    </div>
  );
}
