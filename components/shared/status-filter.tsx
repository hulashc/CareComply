"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type StatusFilterProps = {
  label: string;
  options: { value: string; label: string }[];
  current: string;
  paramName?: string;
};

export function StatusFilter({ label, options, current, paramName = "status" }: StatusFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setFilter(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") params.delete(paramName);
    else params.set(paramName, value);
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">{label}</label>
      <Select value={current} onValueChange={setFilter}>
        <SelectTrigger className="h-8 w-[130px] rounded-lg text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
