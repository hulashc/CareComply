"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export default function AnalyticsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-0 shadow-card border-destructive">
        <CardHeader><CardTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" />Error Loading Analytics</CardTitle></CardHeader>
        <CardContent className="space-y-4"><p className="text-sm text-muted-foreground">{error.message || "An unexpected error occurred."}</p><Button variant="outline" onClick={reset} className="rounded-xl">Try Again</Button></CardContent>
      </Card>
    </div>
  );
}
