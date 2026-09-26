"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, LayoutDashboard, Users, Heart, CalendarClock, FileText, UserPlus, Send, Upload, AlertTriangle, Settings, FileCheck, Plus, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Command = {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  href: string;
  section: string;
  shortcut?: string;
};

const commands: Command[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard", section: "Navigate", shortcut: "G D" },
  { id: "clients", label: "Clients", icon: Heart, href: "/dashboard/clients", section: "Navigate", shortcut: "G C" },
  { id: "carers", label: "Carers", icon: Users, href: "/dashboard/carers", section: "Navigate", shortcut: "G W" },
  { id: "shifts", label: "Shifts", icon: CalendarClock, href: "/dashboard/shifts", section: "Navigate", shortcut: "G S" },
  { id: "applications", label: "Applications", icon: FileText, href: "/dashboard/applications", section: "Navigate", shortcut: "G A" },
  { id: "incidents", label: "Incidents", icon: AlertTriangle, href: "/dashboard/incidents", section: "Navigate", shortcut: "G I" },
  { id: "compliance", label: "Compliance Report", icon: FileCheck, href: "/dashboard/compliance", section: "Navigate" },
  { id: "settings", label: "Settings", icon: Settings, href: "/dashboard/settings", section: "Navigate" },
  { id: "add-carer", label: "Add Carer", icon: UserPlus, href: "/dashboard/add-carer", section: "Quick Add" },
  { id: "invite-carer", label: "Invite Carer", icon: Send, href: "/dashboard/invite-carer", section: "Quick Add" },
  { id: "add-document", label: "Add Document", icon: Upload, href: "/dashboard/add-document", section: "Quick Add" },
  { id: "add-client", label: "Add Client", icon: Plus, href: "/dashboard/clients/new", section: "Quick Add" },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = commands.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase())
  );

  const grouped = filtered.reduce((acc, cmd) => {
    if (!acc[cmd.section]) acc[cmd.section] = [];
    acc[cmd.section].push(cmd);
    return acc;
  }, {} as Record<string, Command[]>);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
        setQuery("");
        setSelectedIndex(0);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const navigate = useCallback((index: number) => {
    if (index < 0) setSelectedIndex(filtered.length - 1);
    else if (index >= filtered.length) setSelectedIndex(0);
    else setSelectedIndex(index);
  }, [filtered.length]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); navigate(selectedIndex + 1); }
    if (e.key === "ArrowUp") { e.preventDefault(); navigate(selectedIndex - 1); }
    if (e.key === "Enter") {
      e.preventDefault();
      const cmd = filtered[selectedIndex];
      if (cmd) { router.push(cmd.href); setOpen(false); }
    }
  }

  if (!open) return null;

  let globalIndex = -1;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[20vh]">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative z-10 w-full max-w-lg mx-4 rounded-2xl border bg-card shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Search pages and actions..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded-md border bg-muted px-1.5 text-[10px] font-mono text-muted-foreground">⌘K</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {Object.entries(grouped).map(([section, cmds]) => (
            <div key={section} className="mb-1">
              <div className="px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground">{section}</div>
              {cmds.map((cmd) => {
                globalIndex++;
                const isSelected = globalIndex === selectedIndex;
                return (
                  <button
                    key={cmd.id}
                    onClick={() => { router.push(cmd.href); setOpen(false); }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                      isSelected ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-muted"
                    )}
                  >
                    <cmd.icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-left">{cmd.label}</span>
                    {cmd.shortcut && (
                      <kbd className="hidden sm:inline-flex h-5 items-center rounded border bg-muted px-1.5 text-[10px] font-mono text-muted-foreground">{cmd.shortcut}</kbd>
                    )}
                    {isSelected && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
                  </button>
                );
              })}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">No results found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
