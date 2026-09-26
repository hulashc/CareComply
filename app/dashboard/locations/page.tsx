"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MapPin, Plus, Phone, Mail, Building2, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

type Location = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
  carer_count?: number;
  client_count?: number;
};

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", address: "", phone: "", email: "" });
  const [submitting, setSubmitting] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState<{ id: string; name: string; active: boolean } | null>(null);

  useEffect(() => { fetchLocations(); }, []);

  async function fetchLocations() {
    const res = await fetch("/api/locations");
    if (res.ok) {
      const data = await res.json();
      setLocations(data);
    }
    setLoading(false);
  }

  async function handleCreate() {
    if (!form.name.trim()) return;
    setSubmitting(true);
    await fetch("/api/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ name: "", address: "", phone: "", email: "" });
    setShowForm(false);
    await fetchLocations();
    setSubmitting(false);
  }

  async function handleToggle(id: string, isActive: boolean) {
    await fetch(`/api/locations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !isActive }),
    });
    await fetchLocations();
  }

  const filtered = locations.filter(loc =>
    !search
    || loc.name.toLowerCase().includes(search.toLowerCase())
    || (loc.address ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Locations</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your care service sites.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search locations..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 w-44 rounded-lg border border-border/50 bg-background pl-9 pr-3 text-xs outline-none focus:border-primary/50"
            />
          </div>
          <Button className="rounded-xl gap-2" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4" /> Add Location
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="rounded-xl border border-border/50 shadow-card">
          <CardHeader><CardTitle className="text-base font-semibold">New Location</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Name *</label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Main Office" className="rounded-xl mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Phone</label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Optional" className="rounded-xl mt-1" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Address</label>
                <Textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Full address" className="rounded-xl mt-1" rows={2} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Email</label>
                <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Optional" className="rounded-xl mt-1" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={submitting || !form.name.trim()} className="rounded-xl">
                {submitting ? "Creating..." : "Create Location"}
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)} className="rounded-xl">Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="rounded-xl border border-border/50 shadow-card">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <div className="space-y-2"><Skeleton className="h-4 w-28" /><Skeleton className="h-3 w-16" /></div>
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : locations.length === 0 ? (
        <EmptyState icon={MapPin} title="No locations yet" description="Add your first care site to start organizing staff and clients by location." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="No matching locations" description="Try a different search term." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(loc => (
            <Card key={loc.id} className="rounded-xl border border-border/50 shadow-card hover:shadow-elevated transition-shadow">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{loc.name}</h3>
                      <StatusBadge status={loc.is_active ? "active" : "inactive"} />
                    </div>
                  </div>
                </div>
                {loc.address && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{loc.address}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {loc.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{loc.phone}</span>}
                  {loc.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{loc.email}</span>}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" className="rounded-lg text-xs" onClick={() => setConfirmToggle({ id: loc.id, name: loc.name, active: loc.is_active })}>
                    {loc.is_active ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmToggle !== null}
        title={confirmToggle?.active ? "Deactivate Location" : "Activate Location"}
        description={
          confirmToggle?.active
            ? `Deactivate "${confirmToggle?.name}"? Carers and clients linked to this location won't be affected.`
            : `Activate "${confirmToggle?.name}"?`
        }
        confirmLabel={confirmToggle?.active ? "Deactivate" : "Activate"}
        variant="destructive"
        loading={submitting}
        onConfirm={() => {
          if (!confirmToggle) return;
          handleToggle(confirmToggle.id, confirmToggle.active);
          setConfirmToggle(null);
        }}
        onCancel={() => setConfirmToggle(null)}
      />
    </div>
  );
}
