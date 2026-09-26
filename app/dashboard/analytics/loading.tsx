import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function AnalyticsLoading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-8 w-40 rounded-lg" />
      <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i => <Card key={i} className="rounded-2xl border-0"><CardContent className="p-5"><Skeleton className="h-4 w-20 rounded-lg mb-2" /><Skeleton className="h-8 w-16 rounded-lg" /><Skeleton className="mt-2 h-2 w-full rounded-full" /></CardContent></Card>)}</div>
      <div className="grid grid-cols-2 gap-6">
        <Card className="rounded-2xl border-0"><CardContent className="p-6"><Skeleton className="h-5 w-32 rounded-lg mb-4" />{[1,2,3].map(i => <Skeleton key={i} className="mb-3 h-6 w-full rounded-lg" />)}</CardContent></Card>
        <Card className="rounded-2xl border-0"><CardContent className="p-6"><Skeleton className="h-5 w-32 rounded-lg mb-4" />{[1,2,3].map(i => <Skeleton key={i} className="mb-3 h-6 w-full rounded-lg" />)}</CardContent></Card>
      </div>
    </div>
  );
}
