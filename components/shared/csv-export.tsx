"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

type CsvExportProps = {
  data: Record<string, string | number | null | undefined>[];
  filename: string;
  label?: string;
};

export function CsvExport({ data, filename, label = "Export CSV" }: CsvExportProps) {
  if (!data.length) return null;

  function exportCsv() {
    const headers = Object.keys(data[0]);
    const rows = data.map((row) =>
      headers.map((h) => {
        const val = row[h];
        if (val === null || val === undefined) return "";
        const str = String(val);
        return str.includes(",") || str.includes('"') || str.includes("\n")
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={exportCsv}>
      <Download className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
