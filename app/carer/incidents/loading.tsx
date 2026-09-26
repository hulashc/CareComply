import { Skeleton } from "@/components/ui/skeleton";

export default function CarerIncidentsLoading() {
  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <Skeleton className="h-4 w-16 rounded-lg" />
      <Skeleton className="h-7 w-36 rounded-lg" />
      <Skeleton className="h-10 w-full rounded-xl" />
      <Skeleton className="h-20 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-10 rounded-xl" />
        <Skeleton className="h-10 rounded-xl" />
      </div>
      <Skeleton className="h-10 w-full rounded-xl" />
    </div>
  );
}
