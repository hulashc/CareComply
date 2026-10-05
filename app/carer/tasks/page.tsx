"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, Search, ClipboardList, ArrowLeft, Clock } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import Link from "next/link";
import { carerApi, clientJoinName, type CarerTask } from "@/lib/carer-api";

const priorityColors: Record<string, string> = {
  low: "bg-blue-50 text-blue-600",
  medium: "bg-amber-50 text-amber-600",
  high: "bg-red-50 text-red-600",
};

export default function CarerTasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<CarerTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const t = await carerApi.tasks();
      setTasks(t);
    } catch { router.push("/auth/login"); return; }
    setLoading(false);
  }

  async function completeTask(id: string) {
    await carerApi.completeTask(id);
    loadData();
  }

  const filtered = tasks.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase()) || clientJoinName(t.clients).toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pending = filtered.filter(t => t.status === "pending");
  const completed = filtered.filter(t => t.status === "completed");

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/carer" className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors">
          <ArrowLeft className="h-4 w-4 text-slate-600" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Tasks</h1>
          <p className="text-xs text-slate-500">{pending.length} pending · {completed.length} completed</p>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search tasks..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="rounded-lg border-slate-200 bg-white pl-9 h-9 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium h-9 cursor-pointer"
        >
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="completed">Done</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl bg-white border border-slate-200 p-6 text-center">
          <EmptyState icon={ClipboardList} title={search ? "No matches" : "All clear!"} description={search ? "Try a different search." : "No pending tasks."} />
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Pending ({pending.length})</p>
              {pending.map((t) => (
                <div key={t.id} className="rounded-xl bg-white border border-slate-200 p-3.5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <button
                        onClick={() => completeTask(t.id)}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 opacity-0 hover:opacity-100" />
                      </button>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{t.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-slate-500">{clientJoinName(t.clients) || "—"}</span>
                          <Badge className={`rounded-full text-[10px] font-semibold border-0 ${priorityColors[t.priority ?? ""] || "bg-slate-50 text-slate-600"}`}>{t.priority || "normal"}</Badge>
                          {t.due_date && (
                            <span className="text-[11px] text-slate-500 flex items-center gap-1">
                              <Clock className="h-3 w-3" />{new Date(t.due_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => completeTask(t.id)}
                      className="shrink-0 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-600 hover:bg-emerald-100 transition-colors ml-2"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {completed.length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] font-bold uppercase text-slate-400 tracking-wider pt-2">Completed ({completed.length})</p>
              {completed.slice(0, 10).map((t) => (
                <div key={t.id} className="flex items-center gap-2.5 rounded-lg border border-slate-100 bg-slate-50/50 p-2.5 text-sm opacity-70">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span className="line-through text-slate-500 font-medium truncate">{t.title}</span>
                  <span className="text-xs text-slate-400 ml-auto shrink-0">{clientJoinName(t.clients)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
