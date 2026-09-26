import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function SettingsLoading() {
  return (
    <div className="space-y-8 max-w-2xl">
      <Skeleton className="h-8 w-32 rounded-lg" />
      <Card className="rounded-2xl border-0"><CardContent className="p-6"><Skeleton className="h-10 w-10 rounded-xl" /><Skeleton className="mt-3 h-4 w-48 rounded-lg" /><Skeleton className="mt-1 h-3 w-64 rounded-lg" /><Skeleton className="mt-4 h-10 w-full rounded-xl" /><Skeleton className="mt-3 h-10 w-full rounded-xl" /></CardContent></Card>
    </div>
  );
}
