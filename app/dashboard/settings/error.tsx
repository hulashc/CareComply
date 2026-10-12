"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export default function SettingsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-0 shadow-card" style={{ borderLeft: "4px solid hsl(var(--primary))" }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-fuchsia-500">
              <AlertTriangle className="h-4 w-4 text-white" />
            </div>
            Error Loading Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{error.message || "An unexpected error occurred."}</p>
          <Button variant="outline" onClick={reset} className="rounded-xl">Try Again</Button>
        </CardContent>
      </Card>
    </div>
  );
}
