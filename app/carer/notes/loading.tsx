import { Skeleton } from "@/components/ui/skeleton";

export default function CarerNotesLoading() {
  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <Skeleton className="h-4 w-16 rounded-lg" />
      <Skeleton className="h-7 w-32 rounded-lg" />
      <Skeleton className="h-10 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 rounded-xl" />)}
      </div>
      <Skeleton className="h-10 w-full rounded-xl" />
    </div>
  );
}
