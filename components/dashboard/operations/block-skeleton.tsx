import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder for the pill row while the operations data loads. */
export function OperationsGridSkeleton({ pills = 10 }: { pills?: number }) {
  return (
    <div role="status" aria-label="Loading dashboard blocks" className="mb-6 space-y-3">
      <Skeleton className="h-9 w-44 rounded-lg" />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: pills }, (_, i) => (
          <Skeleton key={i} className="h-9 rounded-full" style={{ width: `${110 + ((i * 37) % 70)}px` }} />
        ))}
      </div>
    </div>
  );
}
