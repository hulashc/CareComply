"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Send, Check, Copy, Link2 } from "lucide-react";

export default function InviteCarerPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const res = await fetch("/api/applications/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Something went wrong");
      setSubmitting(false);
      return;
    }

    setLink(data.link);
    setSubmitting(false);
  }

  function copyLink() {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Invite Carer</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate a secure application link to send to a carer.
        </p>
      </div>

      <Card className="rounded-xl border border-border/50 shadow-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
              <Send className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <CardTitle>New Invitation</CardTitle>
              <CardDescription className="mt-0.5">The carer will complete their own application form.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!link ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label htmlFor="fullName" className="text-sm font-medium">Full Name *</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="mt-1.5 rounded-xl"
                  placeholder="Jane Smith"
                />
              </div>
              <div>
                <Label htmlFor="email" className="text-sm font-medium">Email (optional)</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 rounded-xl"
                  placeholder="jane@example.com"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={submitting} className="w-full rounded-xl">
                {submitting ? "Generating Link..." : "Generate Invite Link"}
              </Button>
            </form>
          ) : (
            <div className="space-y-5">
              <div className="rounded-2xl border bg-muted/50 p-6 text-center">
                <Link2 className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">Application link ready</p>
                <p className="mt-1 text-xs text-muted-foreground">Share this secure link with {fullName}</p>
                <div className="mt-4 rounded-xl border bg-background p-3 text-sm break-all font-mono">
                  {link}
                </div>
              </div>
              <div className="flex gap-3">
                <Button onClick={copyLink} variant="secondary" disabled={copied} className="flex-1 rounded-xl">
                  {copied ? (
                    <>
                      <Check className="mr-1.5 h-4 w-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1.5 h-4 w-4" />
                      Copy Link
                    </>
                  )}
                </Button>
                <Button onClick={() => { setLink(""); setCopied(false); }} variant="ghost" className="rounded-xl">
                  Invite Another
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
