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
  const isActive = (href: string) => pathname === href || (href !== "/carer" && pathname.startsWith(href));

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <main className="mx-auto max-w-lg px-4 py-5">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-lg flex items-center justify-around px-2 pt-1.5 pb-2">
          {tabs.map((tab) => {
            const active = isActive(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[10px] font-semibold tracking-wide transition-colors",
                  active ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
                )}
              >
                <div className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
                  active && "bg-indigo-50"
                )}>
                  <tab.icon className={cn("h-4 w-4", active && "text-indigo-600")} />
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
