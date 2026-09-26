import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function ClientDetailLoading() {
  return (
    <div className="space-y-6 max-w-4xl">
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
      <div className="grid grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="rounded-2xl border-0 shadow-card">
            <CardContent className="p-5">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="mt-2 h-6 w-12 rounded-lg" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="rounded-2xl border-0 shadow-card">
        <CardContent className="p-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="mb-3 h-24 w-full rounded-xl" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
