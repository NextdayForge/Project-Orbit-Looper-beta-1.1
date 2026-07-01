import { useCallback, useState } from 'react';
import { classify } from '../intelligence/planner/DayTypeClassifier';
import { planCapacity } from '../intelligence/planner/CapacityPlanner';
import { GeminiPlacementStrategy } from '../intelligence/planner/GeminiPlacementStrategy';
import { place, PlacementEngine } from '../intelligence/planner/PlacementEngine';
import {
  getAnchorSessionsForReplan,
  selectTasksForPlacement,
} from '../intelligence/planner/placementTaskSelector';
import { AiPlacementAudit, PlacementDecisionRecord } from '../intelligence/planner/types';
import {
  calendarBlockRepository,
  decisionLogRepository,
  routineRepository,
  sessionRepository,
  settingsRepository,
  taskRepository,
  userModelRepository,
} from '../repositories';
import { expandRoutinesForDate, withoutRoutineVirtualBlocks } from '../intelligence/planner/routineExpansion';
import { CalendarBlock } from '../types/calendarBlock';
import { DayPlan, MiddayAdjustmentResult } from '../types/dayPlan';
import { DecisionLog, DecisionLogType } from '../types/decisionLog';
import { Session, isMutableScheduleSession } from '../types/session';
import { Task } from '../types/task';
import { toPlannerContext } from '../types/userModel';
import { generateId, snapToMinutes, toDateKey } from '../utils/time';
import {
  isPlanningToday,
  resolvePlacementCursorStart,
  resolveTodayCursorMinutes,
} from '../intelligence/planner/plannerCursor';
import {
  shiftIncompleteSessionsFromNow,
} from '../intelligence/planner/shiftFromNow';

function resolvePlacementOptions(date: string, dayStartMinutes: number, dayEndMinutes: number) {
  return {
    cursorStartMinutes: resolvePlacementCursorStart(date, dayStartMinutes),
    dayStartMinutes,
    dayEndMinutes,
  };
}

function dedupeSessionsById(sessions: Session[]): Session[] {
  const byId = new Map<string, Session>();
  for (const session of sessions) {
    byId.set(session.id, session);
  }
  return [...byId.values()];
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

function buildPlannerDecisionLog(
  type: Extract<DecisionLogType, 'planner_generate' | 'planner_midday_adjustment'>,
  plan: DayPlan
): DecisionLog {
  const reasonTags =
    type === 'planner_midday_adjustment'
      ? [...new Set([...plan.reasonTags, 'midday_adjustment'])]
      : [...plan.reasonTags];

  return {
    id: generateId(),
    date: plan.date,
    type,
    decision: {
      dayType: plan.dayType,
      capacity: plan.capacity,
      sessionCount: plan.sessions.length,
      generatedAt: plan.generatedAt,
    },
    reasonTags,
    inputSnapshot: {},
    outputSnapshot: {},
    createdAt: new Date().toISOString(),
  };
}

async function appendPlannerDecisionLog(
  type: Extract<DecisionLogType, 'planner_generate' | 'planner_midday_adjustment'>,
  plan: DayPlan
): Promise<void> {
  await decisionLogRepository.append(buildPlannerDecisionLog(type, plan));
}

function buildAiPlacementDecisionLog(date: string, audit: AiPlacementAudit): DecisionLog {
  return {
    id: generateId(),
    date,
    type: 'planner_ai_generate',
    decision: {
      modelName: audit.modelName,
      usedGemini: audit.usedGemini,
      fellBackToLocal: audit.fellBackToLocal,
      fallbackReason: audit.fallbackReason,
      retryCount: audit.retryCount,
      promptHash: audit.promptHash,
      responseHash: audit.responseHash,
      dayType: audit.dayType,
      capacity: audit.capacity,
      sessionCount: audit.sessionCount,
      generatedAt: audit.generatedAt,
    },
    reasonTags: audit.reasonTags,
    inputSnapshot: {},
    outputSnapshot: {},
    createdAt: new Date().toISOString(),
  };
}

async function appendAiPlacementDecisionLog(date: string, audit: AiPlacementAudit): Promise<void> {
  await decisionLogRepository.append(buildAiPlacementDecisionLog(date, audit));
}

async function appendPlacementDecisionLogs(
  date: string,
  decisions: PlacementDecisionRecord[]
): Promise<void> {
  for (const record of decisions) {
    await decisionLogRepository.append({
      id: generateId(),
      date,
      type: 'placement',
      decision: {
        taskId: record.taskId,
        sessionId: record.sessionId,
        score: record.score,
        candidateSlots: record.candidateSlots,
        chosenSlot: record.chosenSlot,
      },
      reasonTags: record.reasonTags,
      inputSnapshot: {},
      outputSnapshot: {},
      createdAt: new Date().toISOString(),
    });
  }
}

async function computeMiddayAdjustment(sourcePlan: DayPlan): Promise<MiddayAdjustmentResult | null> {
  const now = new Date();
  const nowMinutes = snapToMinutes(now.getHours() * 60 + now.getMinutes(), 5);
  const date = sourcePlan.date;
  const settings = await settingsRepository.get();

  const { sessions: visibleSessions, replanTaskIds } = shiftIncompleteSessionsFromNow(
    date,
    sourcePlan.sessions,
    nowMinutes,
    settings.defaultBufferMinutes
  );

  if (replanTaskIds.length === 0) {
    return null;
  }

  const fixedBlocks = sourcePlan.calendarBlocks.filter((block) => block.type === 'fixed');

  const adjustedPlan: DayPlan = {
    date,
    dayType: sourcePlan.dayType,
    capacity: sourcePlan.capacity,
    sessions: dedupeSessionsById(visibleSessions),
    calendarBlocks: fixedBlocks,
    reasonTags: [...sourcePlan.reasonTags, 'midday_adjustment', 'shift_from_now'],
    generatedAt: new Date().toISOString(),
  };

  return {
    plan: adjustedPlan,
    replanTaskIds,
  };
}

/**
 * Morning DayPlan generation and midday adjustment.
 * Holds in-memory DayPlan VO only (not persisted).
 * DecisionLog audit records are appended via DecisionLogRepository after each run.
 */
export interface GenerateDayPlanOptions {
  /** Full AI replan — Gemini placement. Morning auto-plan and shift stay on local engine. */
  useGeminiPlacement?: boolean;
}

export function useDayPlan() {
  const [dayPlan, setDayPlan] = useState<DayPlan | null>(null);

  const generateDayPlan = useCallback(async (
    date?: Date,
    taskIds?: string[],
    options?: GenerateDayPlanOptions
  ): Promise<DayPlan> => {
    const targetDate = toDateKey(date ?? new Date());

    const [tasks, sessions, persistedBlocks, routines, userModel, settings] = await Promise.all([
      taskRepository.getAll(),
      sessionRepository.getAll(),
      calendarBlockRepository.getAll(),
      routineRepository.getAll(),
      userModelRepository.get(),
      settingsRepository.get(),
    ]);
    // Routines are virtual fixed blocks: used for avoidance, never persisted.
    const routineBlocks = expandRoutinesForDate(routines, targetDate);
    const calendarBlocks = [...persistedBlocks, ...routineBlocks];
    const placementOptions = resolvePlacementOptions(
      targetDate,
      settings.wakeMinutes,
      settings.sleepMinutes
    );
    const now = new Date();
    const isToday = isPlanningToday(targetDate, now);
    const todayCursorMinutes = isToday ? resolveTodayCursorMinutes(now) : undefined;
    const planCursorStart = isToday
      ? todayCursorMinutes
      : placementOptions.cursorStartMinutes;

    if (!taskIds || taskIds.length === 0) {
      const emptyPlan: DayPlan = {
        date: targetDate,
        dayType: 'NORMAL',
        capacity: {
          availableMinutes: 0,
          targetFocusMinutes: 0,
          targetSessionCount: 0,
          bufferMinutes: 0,
          breakMinutes: 0,
          reasonTags: [],
        },
        sessions: [],
        calendarBlocks: persistedBlocks.filter(
          (block) => block.date === targetDate && block.type === 'fixed'
        ),
        reasonTags: ['no_tasks_to_replan'],
        generatedAt: new Date().toISOString(),
      };
      setDayPlan(emptyPlan);
      return emptyPlan;
    }

    const scopedTasks = tasks.filter((task) => taskIds.includes(task.id));
    const placementTasks = selectTasksForPlacement(scopedTasks, sessions, targetDate);
    const anchorSessions = getAnchorSessionsForReplan(sessions, targetDate, taskIds);

    const context = toPlannerContext(userModel);
    const dayTypeResult = classify(context, placementTasks, calendarBlocks, targetDate);
    const cursorStart = planCursorStart ?? settings.wakeMinutes;
    const fixedForDate = calendarBlocks.filter(
      (block) => block.date === targetDate && block.type === 'fixed'
    );
    const remainingAvailable = computeRemainingAvailableMinutes(
      fixedForDate,
      targetDate,
      cursorStart,
      settings.sleepMinutes
    );
    let capacity = planCapacity(context, dayTypeResult.dayType, placementTasks, calendarBlocks, {
      availableMinutesOverride: remainingAvailable,
    });
    capacity = {
      ...capacity,
      targetSessionCount: Math.max(capacity.targetSessionCount, placementTasks.length),
    };
    const placementOptionsWithAnchors = {
      ...placementOptions,
      cursorStartMinutes: planCursorStart,
      anchoredSessions: anchorSessions,
    };
    const placement = options?.useGeminiPlacement
      ? await new PlacementEngine(new GeminiPlacementStrategy()).place(
          context,
          capacity,
          placementTasks,
          calendarBlocks,
          targetDate,
          placementOptionsWithAnchors
        )
      : await place(
          context,
          capacity,
          placementTasks,
          calendarBlocks,
          targetDate,
          placementOptionsWithAnchors
        );

    if (placement.aiAudit) {
      await appendAiPlacementDecisionLog(targetDate, placement.aiAudit);
    }

    if (placement.placementDecisions?.length) {
      await appendPlacementDecisionLogs(targetDate, placement.placementDecisions);
    }

    const planSessions = placement.sessions;
    // Persist only the user's real fixed blocks (never the virtual routine blocks).
    const persistedFixedForDate = persistedBlocks.filter(
      (block) => block.date === targetDate && block.type === 'fixed'
    );
    const planBlocks = withoutRoutineVirtualBlocks(
      isToday ? persistedFixedForDate : placement.blocks
    );

    const plan: DayPlan = {
      date: targetDate,
      dayType: dayTypeResult.dayType,
      capacity,
      sessions: planSessions,
      calendarBlocks: planBlocks,
      reasonTags: [
        ...dayTypeResult.reasonTags,
        ...capacity.reasonTags,
        ...placement.reasonTags,
        ...(isToday ? ['replan_from_now'] : []),
      ],
      generatedAt: new Date().toISOString(),
    };

    setDayPlan(plan);
    await appendPlannerDecisionLog('planner_generate', plan);
    return plan;
  }, []);

  const ensureDayPlanSnapshot = useCallback(async (date: string): Promise<DayPlan> => {
    const [tasks, sessions, calendarBlocks, routines, userModel] = await Promise.all([
      taskRepository.getAll(),
      sessionRepository.getAll(),
      calendarBlockRepository.getAll(),
      routineRepository.getAll(),
      userModelRepository.get(),
    ]);

    const daySessions = sessions.filter((session) => session.date === date);
    const dayBlocks = calendarBlocks.filter((block) => block.date === date);
    // Include routine blocks for classification, but keep them out of the persisted snapshot.
    const avoidanceBlocks = [...dayBlocks, ...expandRoutinesForDate(routines, date)];
    const context = toPlannerContext(userModel);
    const dayTypeResult = classify(context, tasks, avoidanceBlocks, date);
    const capacity = planCapacity(context, dayTypeResult.dayType, tasks, avoidanceBlocks);

    const snapshot: DayPlan = {
      date,
      dayType: dayTypeResult.dayType,
      capacity,
      sessions: daySessions,
      calendarBlocks: dayBlocks,
      reasonTags: [...dayTypeResult.reasonTags, ...capacity.reasonTags],
      generatedAt: new Date().toISOString(),
    };

    setDayPlan(snapshot);
    return snapshot;
  }, []);

  const previewMiddayAdjustment = useCallback(
    async (basePlan: DayPlan): Promise<MiddayAdjustmentResult | null> => {
      return computeMiddayAdjustment(basePlan);
    },
    []
  );

  const commitMiddayAdjustment = useCallback(async (result: MiddayAdjustmentResult): Promise<void> => {
    setDayPlan(result.plan);
    await appendPlannerDecisionLog('planner_midday_adjustment', result.plan);
  }, []);

  const runMiddayAdjustment = useCallback(async (basePlan?: DayPlan): Promise<MiddayAdjustmentResult | null> => {
    const sourcePlan = basePlan ?? dayPlan;
    if (!sourcePlan) {
      return null;
    }

    const adjusted = await computeMiddayAdjustment(sourcePlan);
    if (!adjusted) {
      return null;
    }

    await commitMiddayAdjustment(adjusted);
    return adjusted;
  }, [commitMiddayAdjustment, dayPlan]);

  const clearDayPlan = useCallback(() => {
    setDayPlan(null);
  }, []);

  return {
    dayPlan,
    generateDayPlan,
    ensureDayPlanSnapshot,
    previewMiddayAdjustment,
    commitMiddayAdjustment,
    runMiddayAdjustment,
    clearDayPlan,
  };
}

export type UseDayPlanReturn = ReturnType<typeof useDayPlan>;
