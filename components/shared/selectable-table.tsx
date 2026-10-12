"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkActions } from "@/components/shared/bulk-actions";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

type SelectableTableProps<T> = {
  items: T[];
  columns: { key: string; label: string; render?: (item: T) => React.ReactNode }[];
  idKey?: keyof T;
  hrefPrefix?: string;
};

export function SelectableTable<T extends Record<string, unknown>>({ items, columns, idKey = "id" as keyof T, hrefPrefix }: SelectableTableProps<T>) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected(prev => { const next = new Set(prev); if (next.has(id)) { next.delete(id); } else { next.add(id); } return next; });
  }

  function toggleAll() {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((i) => String(i[idKey]))));
  }

  async function batchApprove() {
    const ids = [...selected];
    for (const id of ids) {
      await fetch(`/api/admin/applications/${id}/approve`, { method: "POST" });
    }
    setSelected(new Set());
    router.refresh();
  }

  async function batchReject() {
    const ids = [...selected];
    for (const id of ids) {
      await fetch(`/api/admin/applications/${id}/reject`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    }
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
            {items.map((item) => {
              const id = String(item[idKey]);
              return (
                <TableRow key={id} className={selected.has(id) ? "bg-accent/20" : "group"}>
                  <TableCell>
                    <Checkbox checked={selected.has(id)} onCheckedChange={() => toggle(id)} />
                  </TableCell>
                  {columns.map(col => (
                    <TableCell key={col.key} className={col.key === columns[0].key ? "font-medium" : "text-muted-foreground"}>
                      {col.render ? col.render(item) : String(item[col.key] ?? "")}
                    </TableCell>
                  ))}
                  <TableCell>
                    {hrefPrefix && (
                      <Link href={`${hrefPrefix}/${id}`}>
                        <Button variant="ghost" size="sm" className="gap-1.5 rounded-lg text-xs font-medium text-primary hover:text-primary">
                          View <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
                        </Button>
                      </Link>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
