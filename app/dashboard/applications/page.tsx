import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { FileSearch, Search } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusFilter } from "@/components/shared/status-filter";
import { ApplicationsTable } from "./applications-table";
import { Pagination } from "@/components/shared/pagination";
import type { Tables } from "@/lib/database.types";

type ApplicationRow = Tables<"applications">;

const APP_STATUSES = [
  { value: "all", label: "All" },
  { value: "pending_review", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "invited", label: "Invited" },
];

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; page?: string }>;
}) {
  const { search, status, page: pageStr } = await searchParams;
  const pageSize = 25;
  const page = Math.max(1, parseInt(pageStr ?? "1") || 1);
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  const orgId = admin?.org_id ?? "";

  let countQuery = supabase
    .from("applications")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);

  let dataQuery = supabase
    .from("applications")
    .select("*")
    .eq("org_id", orgId)
    .order("invited_at", { ascending: false });

  if (search) { countQuery = countQuery.ilike("full_name", `%${search}%`); dataQuery = dataQuery.ilike("full_name", `%${search}%`); }
  if (status && status !== "all") { countQuery = countQuery.eq("status", status); dataQuery = dataQuery.eq("status", status); }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const [{ count }, { data: applications }] = await Promise.all([
    countQuery,
    dataQuery.range(from, to).returns<ApplicationRow[]>(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Applications</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {applications?.length ?? 0} application{(applications?.length ?? 1) !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <StatusFilter label="Status" options={APP_STATUSES} current={status ?? "all"} />
        <form className="flex gap-2" method="get">
          {status && status !== "all" && <input type="hidden" name="status" value={status} />}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="search" placeholder="Search by name..." defaultValue={search} className="pl-9 rounded-xl w-48" />
          </div>
          <Button type="submit" variant="outline" size="sm" className="rounded-xl">Search</Button>
          {(search || (status && status !== "all")) && (
            <Button type="button" variant="ghost" size="sm" className="rounded-xl" onClick={() => window.location.href = "/dashboard/applications"}>Clear</Button>
          )}
        </form>
      </div>

      <Card className="rounded-xl border border-border/50 shadow-card">
        <CardContent className="p-0">
          {(!applications || applications.length === 0) ? (
            <div className="py-12">
              <EmptyState
                icon={FileSearch}
                title={search || (status && status !== "all") ? "No matching applications" : "No applications yet"}
                description={search || (status && status !== "all") ? "Try a different search or filter." : "Invite a carer to fill out their application."}
                action={
                  !search && (!status || status === "all") ? (
                    <Link href="/dashboard/invite-carer">
                      <Button className="rounded-xl">Invite Your First Carer</Button>
                    </Link>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <>
              <ApplicationsTable applications={applications} />
              <div className="px-6 pb-4">
                <Pagination total={count ?? 0} page={page} pageSize={pageSize} />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
