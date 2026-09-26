import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function CarerDetailLoading() {
  return (
    <div className="space-y-6 max-w-3xl">
      <Skeleton className="h-8 w-32 rounded-lg" />
      <Card className="rounded-2xl border-0 shadow-card">
        <CardContent className="p-6">
          <div className="flex gap-4">
            <Skeleton className="h-14 w-14 rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="h-7 w-48 rounded-lg" />
              <Skeleton className="h-4 w-64 rounded-lg" />
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-0 shadow-card">
        <CardContent className="p-6">
          <Skeleton className="h-4 w-full rounded-lg" />
          <Skeleton className="mt-3 h-2 w-full rounded-full" />
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-0 shadow-card">
        <CardContent className="p-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="mb-3 h-14 w-full rounded-xl" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
