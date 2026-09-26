"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Building2, ArrowRight } from "lucide-react";
import { useToast } from "@/components/shared/toast";

export default function OnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [orgName, setOrgName] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function check() {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) { router.push("/auth/login"); return; }

        const { data: admin } = await supabase.from("admins").select("org_id, full_name").eq("id", userData.user.id).single();
        if (!admin?.org_id) { router.push("/dashboard"); return; }

        const { data: org } = await supabase.from("organizations").select("name").eq("id", admin.org_id).single();

        const isFirstNameDefault = !admin.full_name || admin.full_name === "Admin";
        const isOrgNameDefault = !org?.name || org.name === "My Care Home";

        if (!isFirstNameDefault && !isOrgNameDefault) {
          router.push("/dashboard");
          return;
        }

        if (!isFirstNameDefault) setFullName(admin.full_name || "");
        if (!isOrgNameDefault) setOrgName(org?.name || "");
      } catch {
        router.push("/dashboard");
      } finally {
        setChecking(false);
      }
    }
    check();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgName.trim() || !fullName.trim()) {
      setError("Please fill in both fields.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgName: orgName.trim(), fullName: fullName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
      toast(`Welcome, ${fullName.trim()}! Your organisation is all set.`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md rounded-2xl shadow-elevated border border-border/50">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-4">
              <Building2 className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Welcome to CareComply</h1>
            <p className="mt-2 text-sm text-muted-foreground">Let&apos;s set up your care organisation.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-1.5">
              <Label htmlFor="orgName">Organisation Name</Label>
              <Input
                id="orgName"
                placeholder="e.g. Sunrise Care Home"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="rounded-xl"
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="fullName">Your Full Name</Label>
              <Input
                id="fullName"
                placeholder="e.g. Jane Smith"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="rounded-xl"
                required
              />
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/5 rounded-lg px-3 py-2">{error}</p>
            )}

            <Button type="submit" className="w-full rounded-xl gold-accent hover:brightness-110 shadow-glow" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <>Get Started <ArrowRight className="ml-2 h-4 w-4" /></>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
