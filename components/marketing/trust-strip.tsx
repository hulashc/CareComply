import { Shield, Lock, MapPin } from "lucide-react";

const trustItems = [
  { icon: Shield, label: "Mapped to all 5 CQC KLOEs" },
  { icon: Lock, label: "UK-hosted & GDPR compliant" },
  { icon: MapPin, label: "Built for UK care providers" },
];

export function TrustStrip() {
  return (
    <div className="border-b border-border/40 bg-muted/20">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 py-5 text-center sm:justify-between">
        {trustItems.map((item) => (
          <span key={item.label} className="flex items-center gap-2 text-xs font-medium text-muted-foreground sm:text-sm">
            <item.icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
