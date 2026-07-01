import { CalendarBlock } from '../../types/calendarBlock';
import { DayPlan } from '../../types/dayPlan';
import { Reflection } from '../../types/reflection';
import { Session } from '../../types/session';
import { Task } from '../../types/task';
import { PlannerContext, UserModel } from '../../types/userModel';

/** Planner-facing settings slice for task proposals. */
export interface ProposalPlannerSettings {
  wakeMinutes: number;
  sleepMinutes: number;
  defaultDurationMinutes: number;
}

/** Derived capacity signals for proposal scoring (no placement). */
export interface ProposalCapacitySummary {
  targetFocusMinutes: number;
  targetSessionCount: number;
  completedSessionCount: number;
  totalProgressSessionCount: number;
  remainingFocusMinutes: number;
  remainingSessionSlots: number;
  remainingAvailableMinutes: number;
}

/**
 * Aggregated read model for Task Proposal Service.
 * Built from repositories only — no Gemini, UI, or Session placement.
 */
export interface ProposalContext {
  dateKey: string;
  nowMinutes: number;
  isToday: boolean;
  plannerContext: PlannerContext;
  userModel: UserModel;
  /** DayType + capacity snapshot (mirrors ensureDayPlanSnapshot, not a full placement). */
  daySnapshot: DayPlan;
  candidateTaskIds: string[];
  candidateTasks: Task[];
  carryOverTaskIds: string[];
  todaySessions: Session[];
  persistedBlocks: CalendarBlock[];
  routineBlocks: CalendarBlock[];
  fixedBlocks: CalendarBlock[];
  recentReflections: Reflection[];
  learningNotes: string[];
  settings: ProposalPlannerSettings;
  userHint?: string;
  capacity: ProposalCapacitySummary;
}

/** Why this task is in today's proposal pool (no scoring). */
export type CandidateTaskSource =
  | 'carry_over'
  | 'today_unfinished'
  | 'inbox'
  | 'ready';

/**
 * A task eligible for today's proposal, with placement remaining minutes
 * and a single primary source label.
 */
export interface CandidateTask {
  taskId: string;
  task: Task;
  source: CandidateTaskSource;
  remainingMinutes: number;
}

/** Rule-based score signal (initial set). */
export type ScoreReason =
  | 'carry_over'
  | 'deadline_today'
  | 'deadline_within_24h'
  | 'priority_1'
  | 'priority_2';

export interface CandidateScore {
  taskId: string;
  score: number;
  reasons: ScoreReason[];
}

/** Candidate chosen for Gemini proposal (pre-call selection). */
export interface SelectedCandidate {
  taskId: string;
  candidate: CandidateTask;
  score: number;
  reasons: ScoreReason[];
  remainingMinutes: number;
}

export interface BuildProposalContextOptions {
  date?: Date;
  now?: Date;
  userHint?: string;
}

/** Raw store payload for pure assembly (tests and buildProposalContext). */
export interface ProposalContextSourceData {
  dateKey: string;
  now: Date;
  tasks: Task[];
  sessions: Session[];
  persistedBlocks: CalendarBlock[];
  routines: import('../../types/routine').RoutineTemplate[];
  reflections: Reflection[];
  userModel: UserModel;
  settings: import('../../types/schedule').AppSettings;
  userHint?: string;
}
