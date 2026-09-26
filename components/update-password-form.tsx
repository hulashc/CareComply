"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function UpdatePasswordForm({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true); setError(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      router.push("/dashboard");
    } catch (error: unknown) { setError(error instanceof Error ? error.message : "An error occurred"); }
    finally { setIsLoading(false); }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="text-center">
        <h1 className="text-xl font-bold tracking-tight">Set new password</h1>
        <p className="mt-1 text-sm text-muted-foreground">Enter your new password below</p>
      </div>
      <form onSubmit={handleForgotPassword} className="flex flex-col gap-4">
        <div className="grid gap-1.5"><Label htmlFor="password">New Password</Label><Input id="password" type="password" placeholder="Enter new password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-lg" /></div>
        {error && <p className="text-sm text-destructive bg-destructive/5 rounded-lg px-3 py-2">{error}</p>}
        <Button type="submit" className="w-full rounded-lg" disabled={isLoading}>{isLoading ? "Saving..." : "Save New Password"}</Button>
      </form>
    </div>
  );
}
