import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function ComplianceLoading() {
  return (
    <div className="space-y-8 max-w-4xl">
      <Skeleton className="h-8 w-64 rounded-lg" />
      <div className="grid grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <Card key={i} className="rounded-2xl border-0"><CardContent className="p-5"><Skeleton className="h-16 w-16 rounded-full mx-auto" /><Skeleton className="mt-2 h-4 w-full rounded-lg" /></CardContent></Card>)}
      </div>
      <Card className="rounded-2xl border-0"><CardContent className="p-6"><Skeleton className="h-4 w-full rounded-lg" /><Skeleton className="mt-3 h-2 w-full rounded-full" /><div className="grid grid-cols-3 gap-4 mt-4">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div></CardContent></Card>
    </div>
  );
}
