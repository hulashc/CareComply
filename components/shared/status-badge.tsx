import { Badge } from "@/components/ui/badge";

const statusVariantMap: Record<string, string> = {
  invited: "bg-slate-100 text-slate-600 border-slate-200",
  pending_review: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-600 border-red-200",
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  valid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  expiring_soon: "bg-amber-50 text-amber-700 border-amber-200",
  red: "bg-red-50 text-red-600 border-red-200",
  expired: "bg-red-50 text-red-600 border-red-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  scheduled: "bg-blue-50 text-blue-700 border-blue-200",
  cancelled: "bg-red-50 text-red-600 border-red-200",
  open: "bg-red-50 text-red-600 border-red-200",
  resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200",
};

type StatusBadgeProps = {
  status: string;
  className?: string;
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variant = statusVariantMap[status] || "";

  return (
    <Badge className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${variant} ${className || ""}`} variant="outline">
      {status.replace(/_/g, " ").toUpperCase()}
    </Badge>
  );
}
