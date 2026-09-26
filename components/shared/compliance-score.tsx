import { cn } from "@/lib/utils";

type ComplianceScoreProps = {
  green: number;
  amber: number;
  red: number;
  size?: "sm" | "lg";
};

export function ComplianceScore({ green, amber, red, size = "lg" }: ComplianceScoreProps) {
  const total = green + amber + red;
  const pct = total === 0 ? 0 : Math.round((green / total) * 100);

  return (
    <div className={cn("space-y-2", size === "sm" && "space-y-1")}>
      <div className="flex items-center justify-between">
        <span className={cn("font-semibold", size === "sm" ? "text-sm" : "text-lg")}>
          {pct}%
        </span>
        <span className="text-xs text-muted-foreground">
          {green} compliant / {amber} expiring / {red} expired
        </span>
      </div>
      <div className={cn("flex h-2 overflow-hidden rounded-full bg-muted", size === "sm" && "h-1.5")}>
        {green > 0 && (
          <div
            className="bg-green-500 transition-all"
            style={{ width: `${total > 0 ? (green / total) * 100 : 0}%` }}
          />
        )}
        {amber > 0 && (
          <div
            className="bg-amber-400 transition-all"
            style={{ width: `${total > 0 ? (amber / total) * 100 : 0}%` }}
          />
        )}
        {red > 0 && (
          <div
            className="bg-red-400 transition-all"
            style={{ width: `${total > 0 ? (red / total) * 100 : 0}%` }}
          />
        )}
      </div>
    </div>
  );
}
