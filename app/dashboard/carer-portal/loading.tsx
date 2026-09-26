import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function CarerPortalLoading() {
  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="text-center"><Skeleton className="h-16 w-16 rounded-2xl mx-auto" /><Skeleton className="mt-4 h-8 w-40 mx-auto rounded-lg" /></div>
      <Card className="rounded-2xl border-0"><CardContent className="p-6">{[1,2,3].map(i => <Skeleton key={i} className="mb-3 h-14 w-full rounded-xl" />)}</CardContent></Card>
      <Card className="rounded-2xl border-0"><CardContent className="p-6">{[1,2].map(i => <Skeleton key={i} className="mb-3 h-14 w-full rounded-xl" />)}</CardContent></Card>
    </div>
  );
}
