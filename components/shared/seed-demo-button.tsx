"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface Props {
  hasData: boolean;
}

export function SeedDemoButton({ hasData }: Props) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  if (hasData) return null;

  async function handleSeed() {
    setState("loading");
    setMessage("");
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setState("error");
        setMessage(data.error || "Failed to seed data");
        return;
      }
      setState("done");
        const total = Object.values(data.counts as Record<string, number>).reduce((a, b) => a + b, 0);
        setMessage(`Seeded: ${total} records created`);
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      setState("error");
      setMessage("Network error — check console");
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-muted-foreground/30 bg-muted/30 p-6 text-center">
      {state === "idle" && (
        <>
          <Sparkles className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">No data yet</p>
          <p className="mt-1 text-xs text-muted-foreground mb-4">
            Populate Heritage Healthcare Leicester with realistic demo data including carers, clients, shifts, and more.
          </p>
          <Button onClick={handleSeed} className="rounded-xl">
            <Sparkles className="mr-2 h-4 w-4" />
            Seed Demo Data
          </Button>
        </>
      )}
      {state === "loading" && (
        <>
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary mb-3" />
          <p className="text-sm font-medium">Seeding data...</p>
          <p className="mt-1 text-xs text-muted-foreground">Creating carers, clients, shifts, and more</p>
        </>
      )}
      {state === "done" && (
        <>
          <CheckCircle2 className="mx-auto h-8 w-8 text-green-500 mb-3" />
          <p className="text-sm font-medium text-green-600">Done!</p>
          <p className="mt-1 text-xs text-muted-foreground">{message}</p>
        </>
      )}
      {state === "error" && (
        <>
          <AlertCircle className="mx-auto h-8 w-8 text-destructive mb-3" />
          <p className="text-sm font-medium text-destructive">Error</p>
          <p className="mt-1 text-xs text-muted-foreground">{message}</p>
          <Button onClick={handleSeed} variant="outline" className="mt-3 rounded-xl">
            Try Again
          </Button>
        </>
      )}
    </div>
  );
}
