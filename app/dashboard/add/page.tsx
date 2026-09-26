"use client";

import { useState } from "react";
import { UserPlus, Send, Heart, Upload, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import AddCarerForm from "./add-carer-form";
import InviteCarerForm from "./invite-carer-form";
import AddClientForm from "./add-client-form";
import AddDocumentForm from "./add-document-form";

const sections = [
  { id: "carer", label: "Add Carer", icon: UserPlus, desc: "Register a new carer to your organisation." },
  { id: "invite", label: "Invite Carer", icon: Send, desc: "Generate a secure application link to send to a carer." },
  { id: "client", label: "Add Client", icon: Heart, desc: "Register a new care home client." },
  { id: "document", label: "Add Document", icon: Upload, desc: "Log a compliance document for a carer." },
] as const;

export default function QuickAddPage() {
  const [open, setOpen] = useState<string | null>(null);

  const toggle = (id: string) => setOpen(prev => prev === id ? null : id);

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Quick Add</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a carer, client, or document — all from one place.
        </p>
      </div>

      <div className="space-y-3">
        {sections.map((s) => {
          const isOpen = open === s.id;
          const Icon = s.icon;
          return (
            <Card
              key={s.id}
              className={cn(
                "rounded-xl border border-border/50 shadow-card overflow-hidden transition-shadow",
                isOpen && "shadow-md"
              )}
            >
              <button
                type="button"
                onClick={() => toggle(s.id)}
                className="w-full text-left"
              >
                <CardHeader className="cursor-pointer select-none">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent">
                      <Icon className="h-5 w-5 text-accent-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base">{s.label}</CardTitle>
                      <CardDescription className="mt-0.5 text-xs">{s.desc}</CardDescription>
                    </div>
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </div>
                </CardHeader>
              </button>
              {isOpen && (
                <div className="px-6 pb-6">
                  {s.id === "carer" && <AddCarerForm />}
                  {s.id === "invite" && <InviteCarerForm />}
                  {s.id === "client" && <AddClientForm />}
                  {s.id === "document" && <AddDocumentForm />}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
