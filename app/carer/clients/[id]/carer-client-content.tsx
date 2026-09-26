"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Heart, Pill, ClipboardList, AlertTriangle, Loader2, MapPin, Phone, Calendar, Activity } from "lucide-react";
import Link from "next/link";
import { MedAdminButton } from "@/components/shared/med-admin-button";
import { carerApi } from "@/lib/carer-api";

export default function CarerClientContent() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<any>(null);
  const [medications, setMedications] = useState<any[]>([]);
  const [carePlans, setCarePlans] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [carer, setCarer] = useState<any>(null);

  useEffect(() => {
    async function load() {
      try {
        const c = await carerApi.me();
        setCarer(c);
        const detail = await carerApi.clientDetail(id);
        setClient(detail.client);
        setMedications(detail.medications);
        setCarePlans(detail.carePlans);
        setTasks(detail.tasks);
      } catch { setLoading(false); return; }
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
    </div>
  );

  if (!client) return (
    <div className="rounded-xl bg-white border border-slate-200 p-6 text-center">
      <AlertTriangle className="h-8 w-8 text-slate-300 mx-auto mb-2" />
      <p className="text-sm font-bold text-slate-700">Not Assigned</p>
      <p className="text-xs text-slate-500 mt-1">You don&apos;t have a shift with this client.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <Link href="/carer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </Link>

      <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-indigo-500 text-white text-lg font-bold shadow-sm">
            {client.full_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-900 truncate">{client.full_name}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-slate-500">
              {client.address && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{client.address}</span>}
              {client.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{client.phone}</span>}
            </div>
            {client.date_of_birth && (
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> DOB: {new Date(client.date_of_birth).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      </div>

      {carePlans.length > 0 && (
        <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-indigo-500" />
            <h2 className="text-sm font-bold text-slate-800">Care Plan</h2>
          </div>
          <div className="space-y-3">
            {carePlans.map((cp: any) => (
              <div key={cp.id} className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                <h3 className="font-bold text-sm text-slate-800">{cp.title}</h3>
                {cp.goals && <p className="text-sm text-slate-600 mt-1"><span className="font-semibold text-slate-700">Goals:</span> {cp.goals}</p>}
                {cp.interventions && <p className="text-sm text-slate-600 mt-0.5"><span className="font-semibold text-slate-700">Interventions:</span> {cp.interventions}</p>}
                {cp.notes && <p className="text-sm text-slate-500 mt-1 italic">{cp.notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {medications.length > 0 && (
        <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Pill className="h-4 w-4 text-teal-500" />
            <h2 className="text-sm font-bold text-slate-800">MAR Chart</h2>
            <Badge className="ml-auto rounded-full bg-teal-50 text-teal-600 border-0 text-[10px] font-semibold">{medications.length}</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  <th className="pb-2 pr-2">Drug</th>
                  <th className="pb-2 pr-2">Dosage</th>
                  <th className="pb-2 pr-2">Freq</th>
                  <th className="pb-2 pr-2">Route</th>
                  <th className="pb-2">Given</th>
                </tr>
              </thead>
              <tbody>
                {medications.map((m: any) => (
                  <tr key={m.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2.5 pr-2 font-semibold text-slate-800">{m.drug_name}</td>
                    <td className="py-2.5 pr-2 text-slate-500">{m.dosage}</td>
                    <td className="py-2.5 pr-2 text-slate-500">{m.frequency}</td>
                    <td className="py-2.5 text-slate-500 capitalize">{m.route}</td>
                    <td className="py-2.5"><MedAdminButton medicationId={m.id} carerId={carer?.id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tasks.length > 0 && (
        <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="h-4 w-4 text-rose-500" />
            <h2 className="text-sm font-bold text-slate-800">Pending Tasks</h2>
            <Badge className="ml-auto rounded-full bg-rose-50 text-rose-600 border-0 text-[10px] font-semibold">{tasks.length}</Badge>
          </div>
          <div className="space-y-1.5">
            {tasks.map((t: any) => (
              <div key={t.id} className="flex items-center gap-2.5 rounded-lg bg-slate-50 border border-slate-100 p-2.5">
                <ClipboardList className="h-4 w-4 text-rose-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{t.title}</p>
                  {t.description && <p className="text-xs text-slate-500">{t.description}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5 pb-4">
        <Link href={`/carer/notes?client=${id}`} className="block">
          <div className="rounded-xl bg-white border border-slate-200 p-3.5 text-center shadow-sm hover:border-indigo-200 hover:shadow-md transition-all active:scale-[0.97]">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500 mx-auto mb-1.5">
              <Pill className="h-5 w-5 text-white" />
            </div>
            <span className="text-xs font-bold text-slate-700">Record Note</span>
          </div>
        </Link>
        <Link href="/carer/incidents" className="block">
          <div className="rounded-xl bg-white border border-slate-200 p-3.5 text-center shadow-sm hover:border-rose-200 hover:shadow-md transition-all active:scale-[0.97]">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500 mx-auto mb-1.5">
              <AlertTriangle className="h-5 w-5 text-white" />
            </div>
            <span className="text-xs font-bold text-slate-700">Report Issue</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
