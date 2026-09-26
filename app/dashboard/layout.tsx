import { Suspense } from "react";
import DashboardLayoutClient from "./dashboard-layout-client";
import { ToastProvider } from "@/components/shared/toast";
import { SubscriptionGuard } from "@/components/shared/subscription-guard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen bg-background">
          <aside className="hidden lg:flex w-[240px] flex-col bg-sidebar border-r border-white/10">
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-base font-bold text-white">C</div>
              <span className="text-lg font-bold tracking-tight text-white">CareComply</span>
            </div>
            <div className="flex-1 space-y-1 p-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-10 rounded-xl bg-white/5 animate-pulse" />
              ))}
            </div>
          </aside>
          <main className="flex-1 px-6 py-8">
            <div className="animate-pulse space-y-6">
              <div className="h-8 w-48 rounded-xl bg-muted" />
              <div className="grid grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-28 rounded-2xl bg-muted" />)}
              </div>
              <div className="h-64 rounded-2xl bg-muted" />
            </div>
          </main>
        </div>
      }
    >
      <SubscriptionGuard>
        <ToastProvider>
          <DashboardLayoutClient>{children}</DashboardLayoutClient>
        </ToastProvider>
      </SubscriptionGuard>
    </Suspense>
  );
}
