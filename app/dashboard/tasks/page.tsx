import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ClipboardList, Search, ArrowRight } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import type { Tables } from "@/lib/database.types";

type TaskRow = Tables<"tasks"> & { clients: { full_name: string } | null; carers: { full_name: string } | null };

const priorityColors: Record<string, string> = {
  low: "bg-blue-100 text-blue-700",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-red-100 text-red-700",
  urgent: "bg-fuchsia-100 text-fuchsia-700",
};

const statusColors: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  in_progress: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string }>;
}) {
  const { search, status } = await searchParams;
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  const orgId = admin?.org_id ?? "";

  let query = supabase
    .from("tasks")
    .select("*, clients(full_name), carers(full_name)")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (search) query = query.ilike("title", `%${search}%`);
  if (status && status !== "all") query = query.eq("status", status);

  const { data: tasks } = await query.returns<TaskRow[]>();

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">All Tasks</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tasks?.length ?? 0} task{(tasks?.length ?? 1) !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <Card className="rounded-xl border border-border/50 shadow-card">
        <CardHeader className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <CardTitle className="text-lg font-semibold">Tasks</CardTitle>
          <form className="flex gap-2" method="get">
            <div className="relative flex-1 sm:w-48">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input name="search" placeholder="Search tasks..." defaultValue={search} className="pl-9 rounded-xl" />
            </div>
            <select
              name="status"
              className="rounded-xl border border-border/50 bg-background px-3 py-2 text-sm"
              defaultValue={status ?? "all"}
              onChange={(e) => {
                const params = new URLSearchParams(window.location.search);
                if (e.target.value === "all") params.delete("status");
                else params.set("status", e.target.value);
                window.location.search = params.toString();
              }}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <Button type="submit" variant="outline" size="sm" className="rounded-xl">Search</Button>
            {(search || status) && (
              <Button type="button" variant="ghost" size="sm" className="rounded-xl" onClick={() => window.location.href = "/dashboard/tasks"}>Clear</Button>
            )}
          </form>
        </CardHeader>
        <CardContent>
          {(!tasks || tasks.length === 0) ? (
            <EmptyState
              icon={ClipboardList}
              title={search ? "No matching tasks" : "No tasks yet"}
              description={search ? "Try a different search term." : "Tasks will appear here once assigned to carers."}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-medium text-muted-foreground">Title</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Client</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Carer</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Priority</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Status</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Due Date</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground"><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => (
                    <TableRow key={task.id} className="group">
                      <TableCell className="font-medium max-w-[200px] truncate">{task.title}</TableCell>
                      <TableCell className="text-muted-foreground">{task.clients?.full_name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{task.carers?.full_name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge className={`rounded-md text-[10px] ${priorityColors[task.priority] ?? "bg-gray-100 text-gray-700"}`}>
                          {task.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`rounded-md text-[10px] ${statusColors[task.status] ?? "bg-gray-100 text-gray-700"}`}>
                          {task.status?.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {task.due_date ? new Date(task.due_date).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell>
                        <Link href={task.client_id ? `/dashboard/clients/${task.client_id}` : "#"}>
                          <Button variant="ghost" size="sm" className="gap-1.5 rounded-lg text-xs font-medium text-primary hover:text-primary">
                            View Client <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
