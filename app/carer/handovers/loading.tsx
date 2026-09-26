import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function CarerHandoversLoading() {
  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <Skeleton className="h-4 w-16 rounded-lg" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32 rounded-lg" />
        <Skeleton className="h-8 w-20 rounded-xl" />
      </div>
      <div className="space-y-3">
        {[1, 2].map(i => (
          <Card key={i} className="rounded-2xl shadow-card border-0">
            <CardContent className="p-4 space-y-2">
              <Skeleton className="h-4 w-36 rounded-lg" />
              <Skeleton className="h-3 w-full rounded-lg" />
              <Skeleton className="h-3 w-3/4 rounded-lg" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
