"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Trash2 } from "lucide-react";
import { useToast } from "@/components/shared/toast";

type DeleteButtonProps = {
  apiUrl: string;
  entityName: string;
  redirectTo?: string;
  variant?: "ghost" | "outline";
  size?: "sm" | "icon";
};

export function DeleteButton({ apiUrl, entityName, redirectTo, variant = "outline", size = "sm" }: DeleteButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to delete. Please try again.");
      } else {
        setShow(false);
        toast(`${entityName} deleted`);
        if (redirectTo) router.push(redirectTo);
        else router.refresh();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className="rounded-lg text-xs text-destructive hover:bg-red-50 hover:text-destructive border-red-200"
        onClick={() => setShow(true)}
      >
        <Trash2 className="h-3.5 w-3.5" />
        {size !== "icon" && <span className="ml-1.5">Delete</span>}
      </Button>
      <ConfirmDialog
        open={show}
        title={`Delete ${entityName}`}
        description={`Are you sure you want to delete this ${entityName}? This action cannot be undone. All related records will also be removed.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={loading}
        error={error}
        onConfirm={handleDelete}
        onCancel={() => setShow(false)}
      />
    </>
  );
}
