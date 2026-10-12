import type { ReactNode } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CalendarDays,
  CalendarOff,
  ClipboardList,
  GraduationCap,
  ListChecks,
  Timer,
  UserX,
} from "lucide-react";
import type { DashboardOperations } from "@/lib/services/dashboard-service";
import {
  ActualTimesBlock,
  CarePlansBlock,
  ChecklistsBlock,
  ConflictsBlock,
  DiaryBlock,
  TimeOffBlock,
  TrainingBlock,
  UnassignedBlock,
  WeekBlock,
  type BlockMeta,
} from "./blocks";
import {
  summariseActualTimes,
  summariseCarePlans,
  summariseChecklists,
  summariseConflicts,
  summariseDiary,
  summariseTimeOff,
  summariseTraining,
  summariseUnassigned,
  summariseWeek,
  type PillSummary,
} from "./pill-summary";

export interface BlockDefinition {
  meta: BlockMeta;
  /** Set to true to remove a block everywhere (it won't appear in the Configure Dashboard panel). */
  hidden?: boolean;
  /** Whether the block is on the dashboard until the user customises it. */
  defaultVisible: boolean;
  render: (meta: BlockMeta, ops: DashboardOperations, now: Date) => ReactNode;
  /** Count + urgency shown on the closed pill. */
  summarise: (ops: DashboardOperations, now: Date) => PillSummary;
}

/**
 * The dashboard's operational blocks, in display order. Add a block by appending an entry
 * (fetcher in lib/services/dashboard-service.ts, component in ./blocks.tsx); hide one with `hidden`.
 * Primary blocks are visually prominent; secondary blocks are slightly lighter.
 */
export const BLOCK_REGISTRY: BlockDefinition[] = [
  {
    meta: { id: "diary-today", title: "Today's diary", icon: CalendarClock, priority: "primary", viewAllHref: "/dashboard/shifts" },
    defaultVisible: true,
    render: (meta, ops, now) => <DiaryBlock meta={meta} result={ops.diaryToday} now={now} />,
    summarise: (ops, now) => summariseDiary(ops.diaryToday, now),
  },
  {
    meta: { id: "unassigned", title: "Unassigned appointments", icon: UserX, priority: "primary", viewAllHref: "/dashboard/shifts" },
    defaultVisible: true,
    render: (meta, ops, now) => <UnassignedBlock meta={meta} result={ops.unassigned} now={now} />,
    summarise: (ops, now) => summariseUnassigned(ops.unassigned, now),
  },
  {
    meta: { id: "conflicts", title: "Carer conflicts", icon: AlertTriangle, priority: "primary", viewAllHref: "/dashboard/shifts" },
    defaultVisible: true,
    render: (meta, ops, now) => <ConflictsBlock meta={meta} result={ops.conflicts} now={now} />,
    summarise: (ops) => summariseConflicts(ops.conflicts),
  },
  {
    meta: { id: "training", title: "Training", icon: GraduationCap, priority: "primary", viewAllHref: "/dashboard/compliance" },
    defaultVisible: true,
    render: (meta, ops, now) => <TrainingBlock meta={meta} result={ops.training} now={now} />,
    summarise: (ops) => summariseTraining(ops.training),
  },
  {
    meta: { id: "time-off", title: "Time off requests", icon: CalendarOff, priority: "primary", viewAllHref: "/dashboard/absences?status=pending" },
    defaultVisible: true,
    render: (meta, ops, now) => <TimeOffBlock meta={meta} result={ops.timeOff} now={now} />,
    summarise: (ops) => summariseTimeOff(ops.timeOff),
  },
  {
    meta: { id: "week", title: "This week", icon: BarChart3, priority: "primary", viewAllHref: "/dashboard/analytics" },
    defaultVisible: false,
    render: (meta, ops, now) => <WeekBlock meta={meta} result={ops.week} now={now} />,
    summarise: (ops) => summariseWeek(ops.week),
  },
  {
    meta: { id: "diary-tomorrow", title: "Tomorrow's diary", icon: CalendarDays, priority: "secondary", viewAllHref: "/dashboard/shifts" },
    defaultVisible: false,
    render: (meta, ops, now) => <DiaryBlock meta={meta} result={ops.diaryTomorrow} now={now} />,
    summarise: (ops, now) => summariseDiary(ops.diaryTomorrow, now),
  },
  {
    meta: { id: "actual-times", title: "Actual appointment times", icon: Timer, priority: "secondary", viewAllHref: "/dashboard/shifts" },
    defaultVisible: false,
    render: (meta, ops, now) => <ActualTimesBlock meta={meta} result={ops.actualTimes} now={now} />,
    summarise: (ops) => summariseActualTimes(ops.actualTimes),
  },
  {
    meta: { id: "care-plans", title: "Care plans", icon: ClipboardList, priority: "secondary", viewAllHref: "/dashboard/clients" },
    defaultVisible: false,
    render: (meta, ops, now) => <CarePlansBlock meta={meta} result={ops.carePlans} now={now} today={ops.today} />,
    summarise: (ops) => summariseCarePlans(ops.carePlans, ops.today),
  },
  {
    meta: { id: "checklists", title: "Checklists", icon: ListChecks, priority: "secondary", viewAllHref: "/dashboard/tasks?status=pending" },
    defaultVisible: false,
    render: (meta, ops, now) => <ChecklistsBlock meta={meta} result={ops.checklists} now={now} today={ops.today} />,
    summarise: (ops) => summariseChecklists(ops.checklists, ops.today),
  },
];
