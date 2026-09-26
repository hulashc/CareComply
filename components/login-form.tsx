"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true); setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (userId) {
        const carerRes = await fetch("/api/carer/me");
        if (carerRes.ok) { router.push("/carer"); return; }
        const { data: existingAdmin } = await supabase.from("admins").select("id").eq("id", userId).maybeSingle();
        if (existingAdmin) { router.push("/dashboard"); return; }
        const res = await fetch("/api/auth/onboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
        if (!res.ok) {
          setError("Account setup failed. Please try again.");
          return;
        }
        router.push("/dashboard/onboarding");
        return;
      }
      router.push("/dashboard");
    } catch (error: unknown) { setError(error instanceof Error ? error.message : "An error occurred"); }
    finally { setIsLoading(false); }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="text-center">
        <h1 className="text-xl font-bold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to your account</p>
      </div>
      <form onSubmit={handleLogin} className="flex flex-col gap-4">
        <div className="grid gap-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" placeholder="admin@carehome.co.uk" required value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-lg" /></div>
        <div className="grid gap-1.5"><div className="flex items-center"><Label htmlFor="password">Password</Label><Link href="/auth/forgot-password" className="ml-auto text-xs text-muted-foreground hover:text-foreground">Forgot?</Link></div><Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-lg" /></div>
        {error && <p className="text-sm text-destructive bg-destructive/5 rounded-lg px-3 py-2">{error}</p>}
        <Button type="submit" className="w-full rounded-lg" disabled={isLoading}>{isLoading ? "Signing in..." : "Sign In"}</Button>
        <p className="text-center text-sm text-muted-foreground">Don&apos;t have an account? <Link href="/auth/sign-up" className="font-medium text-primary hover:underline">Create one</Link></p>
      </form>
    </div>
  );
}
