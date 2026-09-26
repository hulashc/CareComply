import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function CarerHomeLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-40 rounded-lg" />
          <Skeleton className="mt-1 h-4 w-32 rounded-lg" />
        </div>
        <Skeleton className="h-6 w-20 rounded-lg" />
      </div>
      <Card className="rounded-2xl shadow-card border-0">
        <CardHeader><Skeleton className="h-5 w-36 rounded-lg" /></CardHeader>
        <CardContent className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
        </CardContent>
      </Card>
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
      </div>
    </div>
  );
}
