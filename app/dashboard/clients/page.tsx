import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { Heart, Plus, ArrowRight, Search } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { CsvExport } from "@/components/shared/csv-export";
import { Pagination } from "@/components/shared/pagination";
import type { Tables } from "@/lib/database.types";

type ClientRow = Tables<"clients">;

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const { search, page: pageStr } = await searchParams;
  const pageSize = 25;
  const page = Math.max(1, parseInt(pageStr ?? "1") || 1);
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  const orgId = admin?.org_id ?? "";

  let countQuery = supabase
    .from("clients")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);

  let dataQuery = supabase
    .from("clients")
    .select("*")
    .eq("org_id", orgId)
    .order("full_name", { ascending: true });

  if (search) {
    countQuery = countQuery.ilike("full_name", `%${search}%`);
    dataQuery = dataQuery.ilike("full_name", `%${search}%`);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const [{ count }, { data: clients }] = await Promise.all([
    countQuery,
    dataQuery.range(from, to).returns<ClientRow[]>(),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {clients?.length ?? 0} client{(clients?.length ?? 1) !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/dashboard/clients/new">
          <Button className="rounded-xl gap-2">
            <Plus className="h-4 w-4" />
            Add Client
          </Button>
        </Link>
      </div>

      <Card className="rounded-xl border border-border/50 shadow-card">
        <CardHeader className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <CardTitle className="text-lg font-semibold">All Clients</CardTitle>
          <form className="flex gap-2" method="get">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="search"
                placeholder="Search by name..."
                defaultValue={search}
                className="pl-9 rounded-xl"
              />
            </div>
            <Button type="submit" variant="outline" size="sm" className="rounded-xl">
              Search
            </Button>
            {search && (
              <Button type="button" variant="ghost" size="sm" className="rounded-xl" onClick={() => window.location.href = "/dashboard/clients"}>
                Clear
              </Button>
            )}
          </form>
          <CsvExport
            data={(clients ?? []).map(c => ({ Name: c.full_name, "Date of Birth": c.dob ?? "-", Address: c.address ?? "-" }))}
            filename="clients"
          />
        </CardHeader>
        <CardContent>
          {(!clients || clients.length === 0) ? (
            <EmptyState
              icon={Heart}
              title={search ? "No matching clients" : "No clients yet"}
              description={search ? "Try a different search term." : "Add your first care home client."}
              action={
                !search ? (
                  <Link href="/dashboard/clients/new">
                    <Button className="rounded-xl">Add Your First Client</Button>
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-medium text-muted-foreground">Name</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Date of Birth</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Address</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground"><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => (
                    <TableRow key={client.id} className="group">
                      <TableCell className="font-medium">{client.full_name}</TableCell>
                      <TableCell className="text-muted-foreground">{client.dob || "-"}</TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate">{client.address || "-"}</TableCell>
                      <TableCell>
                        <Link href={`/dashboard/clients/${client.id}`}>
                          <Button variant="ghost" size="sm" className="gap-1.5 rounded-lg text-xs font-medium text-primary hover:text-primary">
                            View <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <Pagination total={count ?? 0} page={page} pageSize={pageSize} />
        </CardContent>
      </Card>
    </div>
  );
}
