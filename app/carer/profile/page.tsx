"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, LogOut, Mail, Phone, MapPin, Calendar } from "lucide-react";
import { carerApi, type CarerRecord } from "@/lib/carer-api";

export default function CarerProfilePage() {
  const router = useRouter();
  const [carer, setCarer] = useState<CarerRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const c = await carerApi.me();
        setCarer(c);
      } catch { router.push("/auth/login"); return; }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSignOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/auth/login");
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
    </div>
  );

  return (
    <div className="flex flex-col items-center py-8">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-teal-500 text-white text-2xl font-bold shadow-md mb-4">
        {carer?.full_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() ?? "?"}
      </div>

      <h1 className="text-xl font-bold text-slate-900">{carer?.full_name ?? "Carer"}</h1>

      <div className="w-full max-w-sm mt-6 space-y-0.5">
        {carer?.email && (
          <div className="flex items-center gap-3 rounded-lg bg-white border border-slate-200 p-3.5">
            <Mail className="h-4 w-4 text-slate-400 shrink-0" />
            <span className="text-sm text-slate-700">{carer.email}</span>
          </div>
        )}
        {carer?.phone && (
          <div className="flex items-center gap-3 rounded-lg bg-white border border-slate-200 p-3.5">
            <Phone className="h-4 w-4 text-slate-400 shrink-0" />
            <span className="text-sm text-slate-700">{carer.phone}</span>
          </div>
        )}
        {carer?.location_name && (
          <div className="flex items-center gap-3 rounded-lg bg-white border border-slate-200 p-3.5">
            <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
            <span className="text-sm text-slate-700">{carer.location_name}</span>
          </div>
        )}
        {carer?.start_date && (
          <div className="flex items-center gap-3 rounded-lg bg-white border border-slate-200 p-3.5">
            <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
            <span className="text-sm text-slate-700">Started {new Date(carer.start_date).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
          </div>
        )}
      </div>

      <div className="mt-8 w-full max-w-sm">
        <Button onClick={handleSignOut} className="w-full h-10 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-700 text-sm font-semibold gap-2">
          <LogOut className="h-4 w-4" /> Sign Out
        </Button>
      </div>
    </div>
  );
}
