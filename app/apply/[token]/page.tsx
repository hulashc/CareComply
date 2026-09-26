import { Suspense } from "react";
import ApplyForm from "./apply-form";
import { Loader2 } from "lucide-react";

export default function ApplyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Loading application...</span>
        </div>
      }
    >
      <ApplyForm />
    </Suspense>
  );
}
