"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Bell, AlertOctagon, Clock, UserCheck, ClipboardList, Loader2 } from "lucide-react";
import Link from "next/link";

export function NotificationBell() {
  const [loading, setLoading] = useState(true);
  const [pendingApps, setPendingApps] = useState(0);
  const [openIncidents, setOpenIncidents] = useState(0);
  const [expiringDocs, setExpiringDocs] = useState(0);
  const [overdueReviews, setOverdueReviews] = useState(0);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const today = new Date().toISOString().split("T")[0];
      const [apps, incidents, docs, plans] = await Promise.all([
        supabase.from("applications").select("*", { count: "exact", head: true }).eq("status", "pending_review"),
        supabase.from("incidents").select("*", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("documents").select("*", { count: "exact", head: true }).eq("status", "amber").is("deleted_at", null),
        supabase.from("care_plans").select("*", { count: "exact", head: true }).eq("status", "active").lt("review_date", today),
      ]);
      setPendingApps(apps.count ?? 0);
      setOpenIncidents(incidents.count ?? 0);
      setExpiringDocs(docs.count ?? 0);
      setOverdueReviews(plans.count ?? 0);
      setLoading(false);
    }
    load();
  }, []);

  const total = pendingApps + openIncidents + expiringDocs + overdueReviews;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-xl text-white/70 hover:text-white hover:bg-white/10">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Bell className="h-4 w-4" />
              {total > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                  {total}
                </span>
              )}
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 rounded-xl p-2">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {pendingApps > 0 && (
          <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
            <Link href="/dashboard/applications" className="flex items-center gap-3 px-3 py-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
                <UserCheck className="h-4 w-4 text-amber-700" />
              </div>
              <div>
                <p className="text-sm font-medium">{pendingApps} pending application{pendingApps !== 1 ? "s" : ""}</p>
                <p className="text-xs text-muted-foreground">Awaiting review</p>
              </div>
            </Link>
          </DropdownMenuItem>
        )}

        {expiringDocs > 0 && (
          <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
            <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
                <Clock className="h-4 w-4 text-amber-700" />
              </div>
              <div>
                <p className="text-sm font-medium">{expiringDocs} document{expiringDocs !== 1 ? "s" : ""} expiring</p>
                <p className="text-xs text-muted-foreground">Within 30 days</p>
              </div>
            </Link>
          </DropdownMenuItem>
        )}

        {openIncidents > 0 && (
          <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
            <Link href="/dashboard/incidents" className="flex items-center gap-3 px-3 py-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100">
                <AlertOctagon className="h-4 w-4 text-red-700" />
              </div>
              <div>
                <p className="text-sm font-medium">{openIncidents} open incident{openIncidents !== 1 ? "s" : ""}</p>
                <p className="text-xs text-muted-foreground">Requires attention</p>
              </div>
            </Link>
          </DropdownMenuItem>
        )}

        {overdueReviews > 0 && (
          <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
            <Link href="/dashboard/clients" className="flex items-center gap-3 px-3 py-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100">
                <ClipboardList className="h-4 w-4 text-purple-700" />
              </div>
              <div>
                <p className="text-sm font-medium">{overdueReviews} overdue review{overdueReviews !== 1 ? "s" : ""}</p>
                <p className="text-xs text-muted-foreground">Care plan review needed</p>
              </div>
            </Link>
          </DropdownMenuItem>
        )}

        {!loading && total === 0 && (
          <div className="flex flex-col items-center py-4 text-center">
            <Bell className="h-6 w-6 text-muted-foreground/30" />
            <p className="mt-2 text-xs text-muted-foreground">All caught up</p>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
