"use client";

import { Button } from "@/components/ui/button";
import { X, CheckCircle2, XCircle } from "lucide-react";

type BulkActionsProps = {
  selectedCount: number;
  totalCount: number;
  onApprove?: () => void;
  onReject?: () => void;
  onClear: () => void;
};

export function BulkActions({ selectedCount, totalCount, onApprove, onReject, onClear }: BulkActionsProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
      <span className="text-sm font-medium">{selectedCount} of {totalCount} selected</span>
      <div className="h-4 w-px bg-border" />
      {onApprove && (
        <Button size="sm" variant="ghost" className="h-8 rounded-lg text-xs text-green-600 hover:bg-green-50 gap-1.5" onClick={onApprove}>
          <CheckCircle2 className="h-3.5 w-3.5" /> Approve
        </Button>
      )}
      {onReject && (
        <Button size="sm" variant="ghost" className="h-8 rounded-lg text-xs text-red-500 hover:bg-red-50 gap-1.5" onClick={onReject}>
          <XCircle className="h-3.5 w-3.5" /> Reject
        </Button>
      )}
      <div className="h-4 w-px bg-border" />
      <Button size="sm" variant="ghost" className="h-8 rounded-lg text-xs gap-1.5" onClick={onClear}>
        <X className="h-3.5 w-3.5" /> Clear
      </Button>
    </div>
  );
}
