"use client";

import Link from "next/link";
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
  MapPin, ChevronLeft, ChevronRight, Shield,
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

const quickActions = [
  { label: "Quick Add", href: "/dashboard/add", icon: Plus },
  { label: "Absences", href: "/dashboard/absences", icon: CalendarX },
  { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
];

function UserMenu({ collapsed }: { collapsed: boolean }) {
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
        <button className={cn(
          "flex items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-white/10 w-full",
          collapsed && "justify-center"
        )} aria-label="Open user menu">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-400 via-purple-500 to-pink-500 text-sm font-bold text-white shadow-sm shadow-purple-500/20">
            {initials}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">{name}</p>
              <p className="text-[11px] text-white/50">Admin</p>
            </div>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side={collapsed ? "right" : "top"} className="w-48 rounded-xl p-2">
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
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("sidebar_collapsed") === "true";
    return false;
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("sidebar_collapsed", String(collapsed));
  }, [collapsed]);

  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const searchParams = useSearchParams();
  const justSubscribed = typeof window !== "undefined" ? sessionStorage.getItem("just_subscribed") === "true" : false;
  const showWelcome = (searchParams.get("welcome") === "subscribed" || justSubscribed) && !welcomeDismissed && !sub.loading && sub.status === "active";

  function dismissWelcome() {
    setWelcomeDismissed(true);
    if (typeof window !== "undefined") sessionStorage.removeItem("just_subscribed");
  }

  const sidebarWidth = collapsed ? "w-[68px]" : "w-[240px]";

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col text-sidebar-foreground transition-all duration-300 shadow-sidebar bg-gradient-to-b from-[#1a1a3e] via-[#1e1a45] to-[#14142e]",
        sidebarWidth,
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Brand */}
        <div className={cn("flex items-center gap-3 border-b border-white/10 px-4 py-4", collapsed && "justify-center px-2")}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-400 via-purple-500 to-pink-500 text-base font-bold text-white shadow-lg shadow-purple-500/30">
            C
          </div>
          {!collapsed && (
            <span className="text-lg font-bold tracking-tight text-white">CareComply</span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 scrollbar-thin">
          {primaryNav.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  collapsed && "justify-center px-2",
                  active
                    ? "bg-gradient-to-r from-purple-500/20 to-pink-500/10 text-white shadow-sm border border-purple-400/20"
                    : "text-white/60 hover:text-white hover:bg-white/8"
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="h-4.5 w-4.5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}

          {!collapsed && (
            <>
              <div className="pt-4 pb-2">
                <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">Quick Actions</p>
              </div>
              {quickActions.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-white/50 transition-all hover:text-white hover:bg-white/8"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              ))}
            </>
          )}
        </nav>

        {/* Collapse toggle (desktop only) */}
        <div className="hidden lg:flex border-t border-white/10 px-3 py-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-white/40 transition-all hover:text-white hover:bg-gradient-to-r hover:from-purple-500/10 hover:to-pink-500/5"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /><span>Collapse</span></>}
          </button>
        </div>

        {/* User */}
        <div className={cn("border-t border-white/10 p-3", collapsed && "px-2")}>
          <UserMenu collapsed={collapsed} />
        </div>
      </aside>

      {/* Main content */}
      <div className={cn("flex-1 flex flex-col transition-all duration-300 lg:ml-[240px]", collapsed && "lg:ml-[68px]")}>
        {/* Mobile top bar */}
        <header className="sticky top-0 z-40 flex items-center gap-4 border-b bg-card/80 backdrop-blur-xl px-4 py-3 lg:hidden">
          <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 hover:bg-muted transition-colors" aria-label="Open sidebar menu">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
          </button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-xs font-bold text-white">C</div>
            <span className="font-bold tracking-tight">CareComply</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
          </div>
        </header>

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

        {/* Page content */}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8 gradient-mesh">
          <div key={pathname} className="animate-fade-up">{children}</div>
        </main>
      </div>

      <CommandPalette /><KeyboardShortcuts />
    </div>
  );
}
