"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkActions } from "@/components/shared/bulk-actions";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";

type SelectableTableProps = {
  items: any[];
  columns: { key: string; label: string; render?: (item: any) => React.ReactNode }[];
  idKey?: string;
  hrefPrefix?: string;
  onApprove?: (ids: string[]) => Promise<void>;
  onReject?: (ids: string[]) => Promise<void>;
};

export function SelectableTable({ items, columns, idKey = "id", hrefPrefix, onApprove, onReject }: SelectableTableProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  function toggle(id: string) {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  function toggleAll() {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((i: any) => i[idKey])));
  }

  async function batchApprove() {
    setLoading(true);
    const ids = [...selected];
    for (const id of ids) {
      await fetch(`/api/admin/applications/${id}/approve`, { method: "POST" });
    }
    setLoading(false);
    setSelected(new Set());
    router.refresh();
  }

  async function batchReject() {
    setLoading(true);
    const ids = [...selected];
    for (const id of ids) {
      await fetch(`/api/admin/applications/${id}/reject`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    }
    setLoading(false);
    setSelected(new Set());
    router.refresh();
  }

  return (
    <>
      <BulkActions
        selectedCount={selected.size}
        totalCount={items.length}
        onApprove={selected.size > 0 ? batchApprove : undefined}
        onReject={selected.size > 0 ? batchReject : undefined}
        onClear={() => setSelected(new Set())}
      />
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10">
                <Checkbox checked={selected.size === items.length && items.length > 0} onCheckedChange={toggleAll} />
              </TableHead>
              {columns.map(col => (
                <TableHead key={col.key} className="text-xs font-medium text-muted-foreground">{col.label}</TableHead>
              ))}
              <TableHead className="text-xs font-medium text-muted-foreground"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item: any) => (
              <TableRow key={item[idKey]} className={selected.has(item[idKey]) ? "bg-accent/20" : "group"}>
                <TableCell>
                  <Checkbox checked={selected.has(item[idKey])} onCheckedChange={() => toggle(item[idKey])} />
                </TableCell>
                {columns.map(col => (
                  <TableCell key={col.key} className={col.key === columns[0].key ? "font-medium" : "text-muted-foreground"}>
                    {col.render ? col.render(item) : item[col.key]}
                  </TableCell>
                ))}
                <TableCell>
                  {hrefPrefix && (
                    <Link href={`${hrefPrefix}/${item[idKey]}`}>
                      <Button variant="ghost" size="sm" className="gap-1.5 rounded-lg text-xs font-medium text-primary hover:text-primary">
                        View <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
                      </Button>
                    </Link>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
