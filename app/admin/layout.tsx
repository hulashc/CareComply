import { Suspense } from "react";
import AdminLayoutClient from "./admin-layout-client";
import { Loader2 } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background">
          <header className="sticky top-0 z-50 border-b bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 backdrop-blur-xl">
            <div className="mx-auto flex max-w-6xl items-center px-6 py-3">
              <span className="text-sm font-bold tracking-tight text-white">Super Admin</span>
            </div>
          </header>
          <main className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </main>
        </div>
      }
    >
      <AdminLayoutClient>{children}</AdminLayoutClient>
    </Suspense>
  );
}
