import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="h-8 w-56 rounded-lg" />
        <Skeleton className="mt-2 h-4 w-72 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="rounded-2xl border-0 shadow-card">
            <CardContent className="p-6">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="mt-4 h-8 w-12 rounded-lg" />
              <Skeleton className="mt-2 h-3 w-24 rounded-lg" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="rounded-2xl border-0 shadow-card">
        <CardContent className="p-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="mb-3 h-12 w-full rounded-xl" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
