"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useState } from "react";

export function ForgotPasswordForm({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true); setError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/update-password` });
      if (error) throw error;
      setSuccess(true);
    } catch (error: unknown) { setError(error instanceof Error ? error.message : "An error occurred"); }
    finally { setIsLoading(false); }
  };

  if (success) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <div className="text-center">
          <h1 className="text-xl font-bold tracking-tight">Check your email</h1>
          <p className="mt-1 text-sm text-muted-foreground">We&apos;ve sent you a password reset link</p>
        </div>
        <p className="text-sm text-muted-foreground text-center">If an account exists with that email, you&apos;ll receive a reset link shortly.</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="text-center">
        <h1 className="text-xl font-bold tracking-tight">Reset password</h1>
        <p className="mt-1 text-sm text-muted-foreground">Enter your email to receive a reset link</p>
      </div>
      <form onSubmit={handleForgotPassword} className="flex flex-col gap-4">
        <div className="grid gap-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" placeholder="admin@carehome.co.uk" required value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-lg" /></div>
        {error && <p className="text-sm text-destructive bg-destructive/5 rounded-lg px-3 py-2">{error}</p>}
        <Button type="submit" className="w-full rounded-lg" disabled={isLoading}>{isLoading ? "Sending..." : "Send Reset Link"}</Button>
        <p className="text-center text-sm text-muted-foreground"><Link href="/auth/login" className="font-medium text-primary hover:underline">Back to sign in</Link></p>
      </form>
    </div>
  );
}
