"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LayoutList, CalendarDays, Columns2 } from "lucide-react";

type ViewType = "list" | "week" | "calendar";

export default function ShiftViewToggle({ currentView }: { currentView: ViewType }) {
  const router = useRouter();

  return (
    <div className="flex rounded-xl border bg-muted/50 p-0.5">
      <Button variant="ghost" size="sm" className={`rounded-lg text-xs gap-1.5 ${currentView === "list" ? "bg-background shadow-sm" : "text-muted-foreground"}`} onClick={() => router.push("/dashboard/shifts")}>
        <LayoutList className="h-3.5 w-3.5" />List
      </Button>
      <Button variant="ghost" size="sm" className={`rounded-lg text-xs gap-1.5 ${currentView === "week" ? "bg-background shadow-sm" : "text-muted-foreground"}`} onClick={() => router.push("/dashboard/shifts?view=week")}>
        <Columns2 className="h-3.5 w-3.5" />Week
      </Button>
      <Button variant="ghost" size="sm" className={`rounded-lg text-xs gap-1.5 ${currentView === "calendar" ? "bg-background shadow-sm" : "text-muted-foreground"}`} onClick={() => router.push("/dashboard/shifts?view=calendar")}>
        <CalendarDays className="h-3.5 w-3.5" />Month
      </Button>
    </div>
  );
}
