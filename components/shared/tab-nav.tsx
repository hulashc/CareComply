"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type Tab = { id: string; label: string };

type TabNavProps = {
  tabs: Tab[];
  defaultTab?: string;
};

export function TabNav({ tabs, defaultTab }: TabNavProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const current = searchParams.get("tab") || defaultTab || tabs[0].id;

  function setTab(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", id);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex gap-1 rounded-xl bg-muted/50 p-1 w-fit">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setTab(tab.id)}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium transition-all",
            current === tab.id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
