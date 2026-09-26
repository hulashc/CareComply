import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function IncidentsLoading() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="h-8 w-40 rounded-lg" />
        <Skeleton className="mt-2 h-4 w-48 rounded-lg" />
      </div>
      <Skeleton className="h-10 w-40 rounded-xl" />
      <Card className="rounded-2xl border-0 shadow-card">
        <CardContent className="p-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="mb-4 h-32 w-full rounded-xl" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
