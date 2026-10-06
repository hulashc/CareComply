import { Suspense } from "react";
import CarerLayoutClient from "./carer-layout-client";
import { ToastProvider } from "@/components/shared/toast";
import { Loader2 } from "lucide-react";

export default function CarerLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-fuchsia-500" />
      </div>
    }>
      <ToastProvider>
        <CarerLayoutClient>{children}</CarerLayoutClient>
      </ToastProvider>
    </Suspense>
  );
}
