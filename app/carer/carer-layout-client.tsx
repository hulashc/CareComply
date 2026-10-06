"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ClipboardList, MessageSquare, ArrowLeftRight, User } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Home", href: "/carer", icon: Home },
  { label: "Tasks", href: "/carer/tasks", icon: ClipboardList },
  { label: "Notes", href: "/carer/notes", icon: MessageSquare },
  { label: "Handovers", href: "/carer/handovers", icon: ArrowLeftRight },
  { label: "Profile", href: "/carer/profile", icon: User },
];

export default function CarerLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const title = tabs.find((t) => (t.href === "/carer" ? pathname === t.href : pathname.startsWith(t.href)))?.label ?? "Home";
  const isActive = (href: string) => pathname === href || (href !== "/carer" && pathname.startsWith(href));

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="hero-bg px-4 pb-16 pt-6">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white text-base font-bold text-primary shadow-card">C</div>
          <div>
            <p className="font-serif text-xs font-light text-white/80">CareComply</p>
            <h1 className="text-xl font-bold leading-tight">{title}</h1>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto -mt-10 max-w-lg px-4">
        <div className="material-card p-4">{children}</div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card shadow-sidebar">
        <div className="mx-auto max-w-lg flex items-center justify-around px-2 pt-1.5 pb-2">
          {tabs.map((tab) => {
            const active = isActive(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[10px] font-semibold tracking-wide transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <div className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
                  active && "bg-primary/10"
                )}>
                  <tab.icon className={cn("h-4 w-4", active && "text-primary")} />
                </div>
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
