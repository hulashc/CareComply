import type { LucideIcon } from "lucide-react";
import { BlockCard, BlockList, BlockRow, type BlockPriority } from "./block-card";
import { UrgencyBadge } from "./urgency-badge";
import { AbsenceQuickActions } from "./absence-quick-actions";
import {
  reviewUrgency,
  taskUrgency,
  unassignedUrgency,
  visitStatus,
  type QualificationGroup,
} from "@/lib/dashboard/shift-logic";
import { formatLondonShortDate, formatLondonTime } from "@/lib/dates/london";
import type {
  BlockResult,
  CarePlanRow,
  ChecklistRow,
  ConflictRow,
  TimeOffRow,
  TimingData,
  VisitRow,
  WeekStats,
} from "@/lib/services/dashboard-service";

const MAX_ROWS = 5;

export interface BlockMeta {
  id: string;
  title: string;
  icon: LucideIcon;
  priority: BlockPriority;
  viewAllHref: string;
}

interface BlockProps<T> {
  meta: BlockMeta;
  result: BlockResult<T>;
  now: Date;
}

/** Wires a fetch result into the shared card shell (error / empty / rows). */
function Shell<T>({
  meta,
  result,
  empty,
  emptyText,
  children,
}: {
  meta: BlockMeta;
  result: BlockResult<T>;
  empty: boolean;
  emptyText?: string;
  children: React.ReactNode;
}) {
  return (
    <BlockCard
      {...meta}
      count={result.ok ? result.total : undefined}
      error={result.ok ? undefined : result.error}
      empty={result.ok && empty}
      emptyText={emptyText}
    >
      {children}
    </BlockCard>
  );
}

const timeRange = (start: string, end: string) => `${formatLondonTime(start)}–${formatLondonTime(end)}`;

// ── 1, 7. Diary (today / tomorrow) ──────────────────────────────────────────

export function DiaryBlock({ meta, result, now }: BlockProps<VisitRow[]>) {
  const rows = result.ok ? result.data : [];
  return (
    <Shell meta={meta} result={result} empty={rows.length === 0}>
      <BlockList>
        {rows.slice(0, MAX_ROWS).map((v) => (
          <BlockRow key={v.id}>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                <span className="tabular-nums text-muted-foreground">{timeRange(v.start_time, v.end_time)}</span> · {v.clientName}
              </p>
              <p className="truncate text-xs text-muted-foreground">{v.carerName ?? "No carer assigned"}</p>
            </div>
            <UrgencyBadge urgency={visitStatus(v, now)} />
          </BlockRow>
        ))}
      </BlockList>
    </Shell>
  );
}

// ── 2. Unassigned ───────────────────────────────────────────────────────────

export function UnassignedBlock({ meta, result, now }: BlockProps<VisitRow[]>) {
  const rows = result.ok ? result.data : [];
  return (
    <Shell meta={meta} result={result} empty={rows.length === 0} emptyText="Every upcoming visit has a carer">
      <BlockList>
        {rows.slice(0, MAX_ROWS).map((v) => (
          <BlockRow key={v.id}>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{v.clientName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {formatLondonShortDate(v.start_time)} · {timeRange(v.start_time, v.end_time)}
              </p>
            </div>
            <UrgencyBadge urgency={unassignedUrgency(v.start_time, now)} />
          </BlockRow>
        ))}
      </BlockList>
    </Shell>
  );
}

// ── 3. Carer conflicts ──────────────────────────────────────────────────────

export function ConflictsBlock({ meta, result }: BlockProps<ConflictRow[]>) {
  const rows = result.ok ? result.data : [];
  return (
    <Shell meta={meta} result={result} empty={rows.length === 0} emptyText="No double-bookings in the next 14 days">
      <BlockList>
        {rows.slice(0, MAX_ROWS).map((c) => {
          const minutes = Math.round((new Date(c.overlapEnd).getTime() - new Date(c.overlapStart).getTime()) / 60_000);
          return (
            <BlockRow key={c.key} href={`/dashboard/carers/${c.carerId}?tab=shifts`}>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{c.carerName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {formatLondonShortDate(c.overlapStart)} · {c.shiftA.clientName} {timeRange(c.shiftA.start, c.shiftA.end)} overlaps{" "}
                  {c.shiftB.clientName} {timeRange(c.shiftB.start, c.shiftB.end)}
                </p>
              </div>
              <UrgencyBadge urgency={{ level: "red", label: `Conflict ${minutes}m` }} />
            </BlockRow>
          );
        })}
      </BlockList>
    </Shell>
  );
}

// ── 4. Training ─────────────────────────────────────────────────────────────

export function TrainingBlock({ meta, result }: BlockProps<QualificationGroup[]>) {
  const rows = result.ok ? result.data : [];
  return (
    <Shell meta={meta} result={result} empty={rows.length === 0} emptyText="All qualifications are in date">
      <BlockList>
        {rows.slice(0, MAX_ROWS).map((g) => (
          <BlockRow key={g.type} href={`/dashboard/carers/${g.mostUrgentCarerId}?tab=qualifications`}>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{g.type}</p>
              <p className="truncate text-xs text-muted-foreground">Review most urgent →</p>
            </div>
            <UrgencyBadge urgency={g.urgency} />
          </BlockRow>
        ))}
      </BlockList>
    </Shell>
  );
}

// ── 5. Time off ─────────────────────────────────────────────────────────────

const ABSENCE_LABELS: Record<string, string> = {
  sick_leave: "Sick leave",
  holiday: "Holiday",
};

export function TimeOffBlock({ meta, result }: BlockProps<TimeOffRow[]>) {
  const rows = result.ok ? result.data : [];
  return (
    <Shell meta={meta} result={result} empty={rows.length === 0} emptyText="No requests awaiting approval">
      <BlockList>
        {rows.slice(0, MAX_ROWS).map((a) => (
          <BlockRow key={a.id}>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{a.carerName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {ABSENCE_LABELS[a.absenceType] ?? a.absenceType.replace(/_/g, " ")} · {a.startDate}
                {a.endDate !== a.startDate ? ` → ${a.endDate}` : ""}
              </p>
            </div>
            <AbsenceQuickActions absenceId={a.id} carerName={a.carerName} />
          </BlockRow>
        ))}
      </BlockList>
    </Shell>
  );
}

// ── 6. This week ────────────────────────────────────────────────────────────

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: "red" | "green" }) {
  return (
    <div className="rounded-lg border border-border/40 bg-background/50 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={
          tone === "red"
            ? "text-lg font-semibold tabular-nums text-destructive"
            : tone === "green"
              ? "text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400"
              : "text-lg font-semibold tabular-nums"
        }
      >
        {value}
      </p>
    </div>
  );
}

export function WeekBlock({ meta, result }: BlockProps<WeekStats>) {
  const w = result.ok ? result.data : null;
  return (
    <Shell meta={meta} result={result} empty={w !== null && w.visits === 0 && w.openIncidents === 0} emptyText="No visits scheduled this week">
      {w && (
        <div className="space-y-2 p-4">
          <p className="text-xs text-muted-foreground">
            {w.rangeLabel.startDate} → {w.rangeLabel.endDate} (Mon–Sun)
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat label="Visits" value={w.visits} />
            <Stat label="Planned hours" value={w.plannedHours} />
            <Stat label="Completed" value={w.completed} tone={w.completed > 0 ? "green" : undefined} />
            <Stat label="Missed" value={w.missed} tone={w.missed > 0 ? "red" : undefined} />
            <Stat label="Open incidents" value={w.openIncidents} tone={w.openIncidents > 0 ? "red" : undefined} />
          </div>
          {(w.missed > 0 || w.openIncidents > 0) && (
            <p className="flex flex-wrap gap-1.5 pt-1">
              {w.missed > 0 && <UrgencyBadge urgency={{ level: "red", label: `${w.missed} missed` }} />}
              {w.openIncidents > 0 && <UrgencyBadge urgency={{ level: "red", label: `${w.openIncidents} open incidents` }} />}
            </p>
          )}
        </div>
      )}
    </Shell>
  );
}

// ── 8. Actual appointment times ─────────────────────────────────────────────

export function ActualTimesBlock({ meta, result }: BlockProps<TimingData>) {
  const data = result.ok ? result.data : null;
  const noneRecorded = data !== null && data.recorded === 0;
  const empty = data !== null && data.flagged.length === 0;
  return (
    <Shell
      meta={meta}
      result={result}
      empty={empty}
      emptyText={noneRecorded ? "No check-ins recorded yet" : "All recent visits started and finished on time"}
    >
      <BlockList>
        {(data?.flagged ?? []).slice(0, MAX_ROWS).map((v) => (
          <BlockRow key={v.id}>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {v.clientName}
                {v.carerName ? <span className="font-normal text-muted-foreground"> · {v.carerName}</span> : null}
              </p>
              <p className="truncate text-xs tabular-nums text-muted-foreground">
                Planned {timeRange(v.start_time, v.end_time)} · Actual {v.actual_start ? formatLondonTime(v.actual_start) : "—"}–
                {v.actual_end ? formatLondonTime(v.actual_end) : "—"}
              </p>
            </div>
            <UrgencyBadge urgency={v.timing.urgency} />
          </BlockRow>
        ))}
      </BlockList>
    </Shell>
  );
}

// ── 9. Care plans ───────────────────────────────────────────────────────────

export function CarePlansBlock({ meta, result, today }: BlockProps<CarePlanRow[]> & { today: string }) {
  const rows = result.ok ? result.data : [];
  return (
    <Shell meta={meta} result={result} empty={rows.length === 0} emptyText="No care plan reviews due">
      <BlockList>
        {rows.slice(0, MAX_ROWS).map((p) => (
          <BlockRow key={p.id} href={`/dashboard/clients/${p.clientId}?tab=care-plans`}>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{p.clientName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {p.title} · review {p.reviewDate}
              </p>
            </div>
            <UrgencyBadge urgency={reviewUrgency(p.reviewDate, today)} />
          </BlockRow>
        ))}
      </BlockList>
    </Shell>
  );
}

// ── 10. Checklists ──────────────────────────────────────────────────────────

export function ChecklistsBlock({ meta, result, today }: BlockProps<ChecklistRow[]> & { today: string }) {
  const rows = result.ok ? result.data : [];
  return (
    <Shell meta={meta} result={result} empty={rows.length === 0} emptyText="No outstanding tasks">
      <BlockList>
        {rows.slice(0, MAX_ROWS).map((t) => (
          <BlockRow key={t.id} href={`/dashboard/clients/${t.clientId}?tab=tasks`}>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{t.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {t.clientName} · {t.priority} priority
              </p>
            </div>
            <UrgencyBadge urgency={taskUrgency(t.dueDate, today)} />
          </BlockRow>
        ))}
      </BlockList>
    </Shell>
  );
}
