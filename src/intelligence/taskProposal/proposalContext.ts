import { classify } from '../planner/DayTypeClassifier';
import { planCapacity } from '../planner/CapacityPlanner';
import { expandRoutinesForDate } from '../planner/routineExpansion';
import {
  getIncompleteTaskIdsBeforeDate,
  resolveMorningReplanTaskIds,
} from '../planner/morningTaskSelector';
import { selectTasksForPlacement } from '../planner/placementTaskSelector';
import { isPlanningToday, resolveTodayCursorMinutes } from '../planner/plannerCursor';
import { buildLearningNotes } from '../../presentation/learning/learningNotes';
import {
  calendarBlockRepository,
  reflectionRepository,
  routineRepository,
  sessionRepository,
  settingsRepository,
  taskRepository,
  userModelRepository,
} from '../../repositories';
import { CalendarBlock } from '../../types/calendarBlock';
import { DayPlan } from '../../types/dayPlan';
import { Reflection } from '../../types/reflection';
import { AppSettings } from '../../types/schedule';
import {
  Session,
  isDayProgressSession,
  isSessionCompleted,
  plannedDurationMinutes,
} from '../../types/session';
import { Task } from '../../types/task';
import { PlannerContext, UserModel, toPlannerContext } from '../../types/userModel';
import { toDateKey } from '../../utils/time';
import {
  BuildProposalContextOptions,
  ProposalCapacitySummary,
  ProposalContext,
  ProposalContextSourceData,
  ProposalPlannerSettings,
} from './types';

const RECENT_REFLECTION_LIMIT = 3;

function pickPlannerSettings(settings: AppSettings): ProposalPlannerSettings {
  return {
    wakeMinutes: settings.wakeMinutes,
    sleepMinutes: settings.sleepMinutes,
    defaultDurationMinutes: settings.defaultDurationMinutes,
  };
}

function computeRemainingAvailableMinutes(
  fixedBlocks: CalendarBlock[],
  date: string,
  fromMinutes: number,
  dayEndMinutes: number
): number {
  let remaining = dayEndMinutes - fromMinutes;

  for (const block of fixedBlocks) {
    if (block.date !== date || block.type !== 'fixed') {
      continue;
    }

    const overlapStart = Math.max(block.startMinutes, fromMinutes);
    const overlapEnd = Math.min(block.endMinutes, dayEndMinutes);
    if (overlapEnd > overlapStart) {
      remaining -= overlapEnd - overlapStart;
    }
  }

  return Math.max(0, remaining);
}

function resolveCursorStartMinutes(dateKey: string, now: Date, wakeMinutes: number): number {
  if (!isPlanningToday(dateKey, now)) {
    return wakeMinutes;
  }
  return Math.max(resolveTodayCursorMinutes(now), wakeMinutes);
}

function buildDaySnapshot(
  dateKey: string,
  tasks: Task[],
  sessions: Session[],
  persistedBlocks: CalendarBlock[],
  routines: ProposalContextSourceData['routines'],
  plannerContext: PlannerContext
): DayPlan {
  const daySessions = sessions.filter((session) => session.date === dateKey);
  const dayBlocks = persistedBlocks.filter((block) => block.date === dateKey);
  const avoidanceBlocks = [...dayBlocks, ...expandRoutinesForDate(routines, dateKey)];
  const dayTypeResult = classify(plannerContext, tasks, avoidanceBlocks, dateKey);
  const capacity = planCapacity(plannerContext, dayTypeResult.dayType, tasks, avoidanceBlocks);

  return {
    date: dateKey,
    dayType: dayTypeResult.dayType,
    capacity,
    sessions: daySessions,
    calendarBlocks: dayBlocks,
    reasonTags: [...dayTypeResult.reasonTags, ...capacity.reasonTags],
    generatedAt: new Date().toISOString(),
  };
}

function selectRecentReflections(reflections: Reflection[], dateKey: string): Reflection[] {
  return reflections
    .filter((reflection) => reflection.date <= dateKey)
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)
    )
    .slice(0, RECENT_REFLECTION_LIMIT);
}

function resolveCandidateTasks(
  tasks: Task[],
  sessions: Session[],
  dateKey: string,
  candidateTaskIds: string[]
): Task[] {
  const placementReady = selectTasksForPlacement(tasks, sessions, dateKey);
  const placementById = new Map(placementReady.map((task) => [task.id, task]));
  const taskById = new Map(tasks.map((task) => [task.id, task]));

  const resolved: Task[] = [];
  const seen = new Set<string>();

  for (const taskId of candidateTaskIds) {
    if (seen.has(taskId)) {
      continue;
    }
    const task = placementById.get(taskId) ?? taskById.get(taskId);
    if (!task) {
      continue;
    }
    seen.add(taskId);
    resolved.push(task);
  }

  return resolved;
}

function buildCapacitySummary(
  daySnapshot: DayPlan,
  todaySessions: Session[],
  fixedBlocks: CalendarBlock[],
  dateKey: string,
  now: Date,
  wakeMinutes: number,
  sleepMinutes: number
): ProposalCapacitySummary {
  const progressSessions = todaySessions.filter(isDayProgressSession);
  const completedSessions = progressSessions.filter(isSessionCompleted);
  const focusDone = completedSessions.reduce(
    (sum, session) => sum + plannedDurationMinutes(session),
    0
  );

  const cursorStart = resolveCursorStartMinutes(dateKey, now, wakeMinutes);
  const fixedForDate = fixedBlocks.filter(
    (block) => block.date === dateKey && block.type === 'fixed'
  );

  return {
    targetFocusMinutes: daySnapshot.capacity.targetFocusMinutes,
    targetSessionCount: daySnapshot.capacity.targetSessionCount,
    completedSessionCount: completedSessions.length,
    totalProgressSessionCount: progressSessions.length,
    remainingFocusMinutes: Math.max(0, daySnapshot.capacity.targetFocusMinutes - focusDone),
    remainingSessionSlots: Math.max(
      0,
      daySnapshot.capacity.targetSessionCount - completedSessions.length
    ),
    remainingAvailableMinutes: computeRemainingAvailableMinutes(
      fixedForDate,
      dateKey,
      cursorStart,
      sleepMinutes
    ),
  };
}

/**
 * Pure assembly from already-loaded repository data.
 */
export function assembleProposalContext(data: ProposalContextSourceData): ProposalContext {
  const { dateKey, now, tasks, sessions, persistedBlocks, routines, reflections, userModel } =
    data;
  const plannerContext = toPlannerContext(userModel);
  const routineBlocks = expandRoutinesForDate(routines, dateKey);
  const dayPersistedBlocks = persistedBlocks.filter((block) => block.date === dateKey);
  const fixedBlocks = [
    ...dayPersistedBlocks.filter((block) => block.type === 'fixed'),
    ...routineBlocks,
  ];
  const todaySessions = sessions.filter((session) => session.date === dateKey);
  const candidateTaskIds = resolveMorningReplanTaskIds(tasks, sessions, dateKey);
  const carryOverTaskIds = getIncompleteTaskIdsBeforeDate(sessions, dateKey);
  const candidateTasks = resolveCandidateTasks(tasks, sessions, dateKey, candidateTaskIds);
  const daySnapshot = buildDaySnapshot(
    dateKey,
    tasks,
    sessions,
    persistedBlocks,
    routines,
    plannerContext
  );
  const settings = pickPlannerSettings(data.settings);

  return {
    dateKey,
    nowMinutes: now.getHours() * 60 + now.getMinutes(),
    isToday: isPlanningToday(dateKey, now),
    plannerContext,
    userModel,
    daySnapshot,
    candidateTaskIds,
    candidateTasks,
    carryOverTaskIds,
    todaySessions,
    persistedBlocks: dayPersistedBlocks,
    routineBlocks,
    fixedBlocks,
    recentReflections: selectRecentReflections(reflections, dateKey),
    learningNotes: buildLearningNotes(userModel),
    settings,
    userHint: data.userHint?.trim() || undefined,
    capacity: buildCapacitySummary(
      daySnapshot,
      todaySessions,
      fixedBlocks,
      dateKey,
      now,
      settings.wakeMinutes,
      settings.sleepMinutes
    ),
  };
}

/**
 * Loads all proposal inputs from repositories and builds ProposalContext.
 */
export async function buildProposalContext(
  options?: BuildProposalContextOptions
): Promise<ProposalContext> {
  const now = options?.now ?? new Date();
  const dateKey = toDateKey(options?.date ?? now);

  const [tasks, sessions, persistedBlocks, routines, reflections, userModel, settings] =
    await Promise.all([
      taskRepository.getAll(),
      sessionRepository.getAll(),
      calendarBlockRepository.getAll(),
      routineRepository.getAll(),
      reflectionRepository.getAll(),
      userModelRepository.get(),
      settingsRepository.get(),
    ]);

  return assembleProposalContext({
    dateKey,
    now,
    tasks,
    sessions,
    persistedBlocks,
    routines,
    reflections,
    userModel,
    settings,
    userHint: options?.userHint,
  });
}

export type { ProposalContext, BuildProposalContextOptions } from './types';
