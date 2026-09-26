"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Check, Copy, Link2 } from "lucide-react";

export default function InviteCarerForm() {
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
    <div className="space-y-4">
      {!link ? (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="ifn" className="text-sm font-medium">Full Name *</Label>
            <Input
              id="ifn"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="mt-1.5 rounded-xl"
              placeholder="Jane Smith"
            />
          </div>
          <div>
            <Label htmlFor="iemail" className="text-sm font-medium">Email (optional)</Label>
            <Input
              id="iemail"
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
                <><Check className="mr-1.5 h-4 w-4" />Copied</>
              ) : (
                <><Copy className="mr-1.5 h-4 w-4" />Copy Link</>
              )}
            </Button>
            <Button onClick={() => { setLink(""); setCopied(false); }} variant="ghost" className="rounded-xl">
              Invite Another
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
