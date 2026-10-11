import { RosterCalendar } from "@/components/roster/roster-calendar";

export const metadata = { title: "Roster" };

// Read-only roster calendar (Phase 2). All data comes from /api/roster/*, which is admin-scoped, so
// this page is just the shell; the dashboard layout already requires a signed-in admin.
export default function RosterPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Roster</h1>
        <p className="mt-1 text-sm text-muted-foreground">Who is visiting whom, and what still needs cover. View only for now.</p>
      </div>
      <RosterCalendar />
    </div>
  );
}
