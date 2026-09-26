import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function CarerTasksLoading() {
  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <Skeleton className="h-4 w-16 rounded-lg" />
      <Skeleton className="h-7 w-24 rounded-lg" />
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <Card key={i} className="rounded-2xl shadow-card border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-6 rounded-full" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-40 rounded-lg" />
                  <Skeleton className="h-3 w-56 rounded-lg" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
