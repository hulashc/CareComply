"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignUpForm({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== repeatPassword) { setError("Passwords do not match"); return; }
    const supabase = createClient();
    setIsLoading(true); setError(null);
    try {
      const { data: signUpData, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/dashboard` } });
      if (error) throw error;
      if (signUpData.user?.identities?.length === 0) {
        setError("An account with this email already exists. Please sign in instead.");
        return;
      }
      if (signUpData.user?.id) {
        const res = await fetch("/api/auth/onboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: signUpData.user.id }) });
        if (!res.ok) {
          setError("Account created but setup failed. Please contact support.");
          return;
        }
      }
      router.push("/auth/sign-up-success");
    } catch (error: unknown) { setError(error instanceof Error ? error.message : "An error occurred"); }
    finally { setIsLoading(false); }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="text-center">
        <h1 className="text-xl font-bold tracking-tight">Create account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Get started with CareComply</p>
      </div>
      <form onSubmit={handleSignUp} className="flex flex-col gap-4">
        <div className="grid gap-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" placeholder="admin@carehome.co.uk" required value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-lg" /></div>
        <div className="grid gap-1.5"><Label htmlFor="password">Password</Label><Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-lg" /></div>
        <div className="grid gap-1.5"><Label htmlFor="repeatPassword">Confirm Password</Label><Input id="repeatPassword" type="password" required minLength={8} value={repeatPassword} onChange={(e) => setRepeatPassword(e.target.value)} className="rounded-lg" /></div>
        {error && <p className="text-sm text-destructive bg-destructive/5 rounded-lg px-3 py-2">{error}</p>}
        <Button type="submit" className="w-full rounded-lg" disabled={isLoading}>{isLoading ? "Creating account..." : "Create Account"}</Button>
        <p className="text-center text-sm text-muted-foreground">Already have an account? <Link href="/auth/login" className="font-medium text-primary hover:underline">Sign in</Link></p>
      </form>
    </div>
  );
}
