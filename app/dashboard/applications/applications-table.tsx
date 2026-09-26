"use client";

import { SelectableTable } from "@/components/shared/selectable-table";
import { StatusBadge } from "@/components/shared/status-badge";

type Application = {
  id: string;
  full_name: string;
  status: string;
  invited_at: string;
  submitted_at: string | null;
};

export function ApplicationsTable({ applications }: { applications: Application[] }) {
  return (
    <SelectableTable
      items={applications}
      columns={[
        { key: "full_name", label: "Name" },
        { key: "status", label: "Status", render: (app: Application) => <StatusBadge status={app.status} /> },
        { key: "invited", label: "Invited", render: (app: Application) => new Date(app.invited_at).toLocaleDateString() },
        { key: "submitted", label: "Submitted", render: (app: Application) => app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : "-" },
      ]}
      hrefPrefix="/dashboard/applications"
    />
  );
}
