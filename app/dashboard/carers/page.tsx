import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { Users, Plus, ArrowRight, Search } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { ComplianceScore } from "@/components/shared/compliance-score";
import { CsvExport } from "@/components/shared/csv-export";
import { Pagination } from "@/components/shared/pagination";
import type { Tables } from "@/lib/database.types";

type CarerRow = Tables<"carers">;
type DocumentRow = Tables<"documents">;

export default async function CarersPage({
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
    .from("carers")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);

  let dataQuery = supabase
    .from("carers")
    .select("*")
    .eq("org_id", orgId)
    .order("full_name", { ascending: true });

  if (search) {
    countQuery = countQuery.ilike("full_name", `%${search}%`);
    dataQuery = dataQuery.ilike("full_name", `%${search}%`);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const [{ count }, { data: carers }] = await Promise.all([
    countQuery,
    dataQuery.range(from, to).returns<CarerRow[]>(),
  ]);

  const { data: documents } = await supabase
    .from("documents")
    .select("*")
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .returns<DocumentRow[]>();

  function getCarerCompliance(carerId: string) {
    const carerDocs = documents?.filter((d) => d.owner_id === carerId) ?? [];
    const green = carerDocs.filter((d) => d.status === "green").length;
    const amber = carerDocs.filter((d) => d.status === "amber").length;
    const red = carerDocs.filter((d) => d.status === "red").length;
    return { green, amber, red };
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Carers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {carers?.length ?? 0} carer{(carers?.length ?? 1) !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/dashboard/add-carer">
          <Button className="rounded-xl gap-2">
            <Plus className="h-4 w-4" />
            Add Carer
          </Button>
        </Link>
      </div>

      <Card className="rounded-xl border border-border/50 shadow-card">
        <CardHeader className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <CardTitle className="text-lg font-semibold">All Carers</CardTitle>
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
              <Button type="button" variant="ghost" size="sm" className="rounded-xl" onClick={() => window.location.href = "/dashboard/carers"}>
                Clear
              </Button>
            )}
          </form>
          <CsvExport
            data={(carers ?? []).map(c => ({ Name: c.full_name, Role: c.role, Email: c.email ?? "-", Phone: c.phone ?? "-" }))}
            filename="carers"
          />
        </CardHeader>
        <CardContent>
          {(!carers || carers.length === 0) ? (
            <EmptyState
              icon={Users}
              title={search ? "No matching carers" : "No carers yet"}
              description={search ? "Try a different search term." : "Add your first carer."}
              action={
                !search ? (
                  <Link href="/dashboard/add-carer">
                    <Button className="rounded-xl">Add Your First Carer</Button>
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
                    <TableHead className="text-xs font-medium text-muted-foreground">Role</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Compliance</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Documents</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground"><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {carers.map((carer) => {
                    const compliance = getCarerCompliance(carer.id);
                    return (
                      <TableRow key={carer.id} className="group">
                        <TableCell className="font-medium">{carer.full_name}</TableCell>
                        <TableCell className="text-muted-foreground capitalize">
                          {carer.role ? carer.role.replace("_", " ") : "-"}
                        </TableCell>
                        <TableCell className="min-w-[160px]">
                          <ComplianceScore
                            green={compliance.green}
                            amber={compliance.amber}
                            red={compliance.red}
                            size="sm"
                          />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {compliance.green + compliance.amber + compliance.red}
                        </TableCell>
                        <TableCell>
                          <Link href={`/dashboard/carers/${carer.id}`}>
                            <Button variant="ghost" size="sm" className="gap-1.5 rounded-lg text-xs font-medium text-primary hover:text-primary">
                              View <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
