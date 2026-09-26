import { Suspense } from "react";
import CarerClientContent from "./carer-client-content";
import { Loader2 } from "lucide-react";

export default function CarerClientPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <CarerClientContent />
    </Suspense>
  );
}
