import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function ShiftsLoading() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="h-8 w-32 rounded-lg" />
        <Skeleton className="mt-2 h-4 w-48 rounded-lg" />
      </div>
      <Skeleton className="h-10 w-36 rounded-xl" />
      <Card className="rounded-2xl border-0 shadow-card">
        <CardContent className="p-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="mb-4">
              <Skeleton className="h-4 w-40 rounded-lg mb-2" />
              <Card className="rounded-xl border-0 bg-muted/30">
                <CardContent className="p-4">
                  {[1, 2].map((j) => (
                    <Skeleton key={j} className="mb-2 h-10 w-full rounded-xl" />
                  ))}
                </CardContent>
              </Card>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
