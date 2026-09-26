"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";

function maskValue(value: string, show: boolean): string {
  if (show || !value) return value;
  if (value.length <= 4) return "••••";
  return "••••" + value.slice(-4);
}

type MaskedFieldProps = {
  label: string;
  value: string | null;
};

export function MaskedField({ label, value }: MaskedFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const displayValue = value || "-";

  return (
    <div className="flex items-center gap-1">
      <span>
        <span className="font-medium">{label}:</span>{" "}
        {maskValue(displayValue, revealed)}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        aria-label={revealed ? "Hide sensitive data" : "Show sensitive data"}
        onClick={() => setRevealed(!revealed)}
      >
        {revealed ? (
          <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </Button>
    </div>
  );
}
