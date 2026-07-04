import { useCallback, useMemo, useState } from 'react';
import {
  ApplyDayPlanResult,
  GenerateDayPlanOptions,
  PlannerGateway,
  PlanApplyOutcome,
} from '../presentation/calendar/CalendarPlannerAdapter';
import { runPlacementWithRollover } from '../presentation/calendar/placementRollover';
import { resolveMorningReplanTaskIds } from '../intelligence/planner/morningTaskSelector';
import {
  buildPastIncompleteRescheduleBatch,
  getIncompleteTaskIdsBeforeDate,
  selectRehomedCarryOverTaskIds,
  titlesForTaskIds,
} from '../intelligence/planner/taskCarryOver';
import { sessionRepository, taskRepository } from '../repositories';
import { toDateKey } from '../utils/time';
import { SaveReflectionInput, useScheduleActions } from './useScheduleActions';
import { useDayPlan } from './useDayPlan';
import { useLearning } from './useLearning';
import { MiddayAdjustmentResult } from '../types/dayPlan';
import { Reflection } from '../types/reflection';
import { Session } from '../types/session';
import { Task } from '../types/task';

async function resolveReplanTaskIds(
  dateKey: string,
  explicitTaskIds?: string[]
): Promise<string[]> {
  if (explicitTaskIds && explicitTaskIds.length > 0) {
    return explicitTaskIds;
  }

  const [sessions, tasks] = await Promise.all([
    sessionRepository.getAll(),
    taskRepository.getAll(),
  ]);

  return resolveMorningReplanTaskIds(tasks, sessions, dateKey);
}

async function finalizeCarryOverFromPast(
  dateKey: string,
  carryOverTaskIds: string[],
  reload: () => Promise<{ tasks: Task[]; sessions: Session[] }>
): Promise<string[]> {
  if (carryOverTaskIds.length === 0) {
    return [];
  }

  const { tasks, sessions } = await reload();
  // Clear the stale past-day session for every carry-over task that now has a
  // home on today OR any later date (placed today, or rolled/bumped to tomorrow).
  // Previously this only fired for tasks placed *today*, so a task rolled to
  // tomorrow kept its active past session and lingered on the past date forever.
  const carriedIds = selectRehomedCarryOverTaskIds(sessions, dateKey, carryOverTaskIds);
  if (carriedIds.length === 0) {
    return [];
  }

  const now = new Date().toISOString();
  const batch = buildPastIncompleteRescheduleBatch(sessions, dateKey, carriedIds, now);
  if (batch.length > 0) {
    await sessionRepository.saveMany(batch);
  }

  return titlesForTaskIds(carriedIds, tasks);
}

/**
 * Thin Facade — composes sub-hooks only. No business logic here.
 * App entry point (Architecture v1.1).
 */
export function useDayOrchestrator() {
  const scheduleActions = useScheduleActions();
  const dayPlanHook = useDayPlan();
  const learning = useLearning();
  const [isPlannerRunning, setIsPlannerRunning] = useState(false);

  const { applyDayPlan, saveReflection: persistReflection, reloadFromRepository } = scheduleActions;
  const {
    dayPlan,
    generateDayPlan,
    ensureDayPlanSnapshot,
    previewMiddayAdjustment,
    commitMiddayAdjustment,
    runMiddayAdjustment,
  } = dayPlanHook;
  const { evaluatePlanner, runLearningPipeline } = learning;

  const syncPlannerSnapshot = useCallback(
    async (date: Date): Promise<void> => {
      await reloadFromRepository();
      await ensureDayPlanSnapshot(toDateKey(date));
    },
    [ensureDayPlanSnapshot, reloadFromRepository]
  );

  const generateDayPlanAndApply = useCallback(
    async (date?: Date, options?: GenerateDayPlanOptions): Promise<PlanApplyOutcome> => {
      setIsPlannerRunning(true);
      try {
        const targetDate = date ?? new Date();
        const dateKey = toDateKey(targetDate);
        const isToday = dateKey === toDateKey(new Date());

        const load = async () => {
          await reloadFromRepository();
          const [tasks, sessions] = await Promise.all([
            taskRepository.getAll(),
            sessionRepository.getAll(),
          ]);
          return { tasks, sessions };
        };

        await reloadFromRepository();
        const taskIds = await resolveReplanTaskIds(dateKey, options?.taskIds);
        if (taskIds.length === 0) {
          return {
            result: 'skipped_empty',
            rolledTomorrowTitles: [],
            bumpedTomorrowTitles: [],
            carriedFromPastTitles: [],
          };
        }

        const { tasks, sessions } = await load();
        const carryOverTaskIds = getIncompleteTaskIdsBeforeDate(sessions, dateKey);

        const outcome = await runPlacementWithRollover({
          targetDate,
          taskIds,
          tasks,
          sessions,
          isToday,
          generateDayPlan,
          applyDayPlan,
          reload: load,
          saveSessions: sessionRepository.saveMany,
        });

        if (outcome.result === 'applied') {
          const carriedFromPastTitles = await finalizeCarryOverFromPast(
            dateKey,
            carryOverTaskIds,
            load
          );
          await syncPlannerSnapshot(targetDate);
          return { ...outcome, carriedFromPastTitles };
        }
        return { ...outcome, carriedFromPastTitles: [] };
      } finally {
        setIsPlannerRunning(false);
      }
    },
    [applyDayPlan, generateDayPlan, reloadFromRepository, syncPlannerSnapshot]
  );

  const runMiddayAdjustmentAndApply = useCallback(
    async (date?: Date): Promise<PlanApplyOutcome> => {
      setIsPlannerRunning(true);
      try {
        const targetDate = date ?? new Date();
        const dateKey = toDateKey(targetDate);

        await reloadFromRepository();
        const snapshot = await ensureDayPlanSnapshot(dateKey);
        const adjusted = await runMiddayAdjustment(snapshot);
        if (!adjusted) {
          return {
            result: 'skipped_empty',
            rolledTomorrowTitles: [],
            bumpedTomorrowTitles: [],
            carriedFromPastTitles: [],
          };
        }

        const result = await applyDayPlan(adjusted.plan, {
          mode:
            adjusted.replanTaskIds.length > 0 ? 'replaceTaskSessions' : 'replaceDay',
          taskIds:
            adjusted.replanTaskIds.length > 0 ? adjusted.replanTaskIds : undefined,
          replaceOnlyWhenPlaced: false,
        });

        if (result === 'applied') {
          await syncPlannerSnapshot(targetDate);
        } else {
          await reloadFromRepository();
        }
        return {
          result,
          rolledTomorrowTitles: [],
          bumpedTomorrowTitles: [],
          carriedFromPastTitles: [],
        };
      } finally {
        setIsPlannerRunning(false);
      }
    },
    [applyDayPlan, ensureDayPlanSnapshot, reloadFromRepository, runMiddayAdjustment, syncPlannerSnapshot]
  );

  const previewReplan = useCallback(
    async (date?: Date): Promise<MiddayAdjustmentResult | null> => {
      await reloadFromRepository();
      const dateKey = toDateKey(date ?? new Date());
      const snapshot = await ensureDayPlanSnapshot(dateKey);
      return previewMiddayAdjustment(snapshot);
    },
    [ensureDayPlanSnapshot, previewMiddayAdjustment, reloadFromRepository]
  );

  const applyReplanPreview = useCallback(
    async (adjusted: MiddayAdjustmentResult, date?: Date): Promise<ApplyDayPlanResult> => {
      setIsPlannerRunning(true);
      try {
        const targetDate = date ?? new Date();
        const result = await applyDayPlan(adjusted.plan, {
          mode: 'replaceTaskSessions',
          taskIds: adjusted.replanTaskIds,
          replaceOnlyWhenPlaced: false,
        });

        if (result === 'applied') {
          await commitMiddayAdjustment(adjusted);
          await syncPlannerSnapshot(targetDate);
        } else {
          await reloadFromRepository();
        }
        return result;
      } finally {
        setIsPlannerRunning(false);
      }
    },
    [applyDayPlan, commitMiddayAdjustment, reloadFromRepository, syncPlannerSnapshot]
  );

  const previewFullReplan = useCallback(
    async (date?: Date): Promise<MiddayAdjustmentResult | null> => {
      const targetDate = date ?? new Date();
      const dateKey = toDateKey(targetDate);

      await reloadFromRepository();
      const taskIds = await resolveReplanTaskIds(dateKey);
      if (taskIds.length === 0) {
        return null;
      }

      const plan = await generateDayPlan(targetDate, taskIds, { useGeminiPlacement: true });
      if (plan.reasonTags.includes('no_tasks_to_replan')) {
        return null;
      }

      return { plan, replanTaskIds: taskIds };
    },
    [generateDayPlan, reloadFromRepository]
  );

  const applyFullReplanPreview = useCallback(
    async (preview: MiddayAdjustmentResult, date?: Date): Promise<ApplyDayPlanResult> => {
      setIsPlannerRunning(true);
      try {
        const targetDate = date ?? new Date();
        const dateKey = toDateKey(targetDate);
        const isToday = dateKey === toDateKey(new Date());

        const result = await applyDayPlan(preview.plan, {
          mode: 'replaceTaskSessions',
          taskIds: preview.replanTaskIds,
          ...(isToday ? { replaceOnlyWhenPlaced: false } : {}),
        });

        if (result === 'applied') {
          await syncPlannerSnapshot(targetDate);
        } else {
          await reloadFromRepository();
        }
        return result;
      } finally {
        setIsPlannerRunning(false);
      }
    },
    [applyDayPlan, reloadFromRepository, syncPlannerSnapshot]
  );

  const saveReflection = useCallback(
    async (input: SaveReflectionInput): Promise<Reflection> => {
      const saved = await persistReflection(input);

      if (dayPlan && dayPlan.date === saved.date) {
        try {
          await evaluatePlanner(dayPlan);
        } catch {
          // Planner evaluation failure must not fail reflection save.
        }
      }

      try {
        await runLearningPipeline(saved.date);
      } catch {
        // Learning failure must not fail reflection save.
      }

      return saved;
    },
    [dayPlan, evaluatePlanner, persistReflection, runLearningPipeline]
  );

  const completeSession = useCallback(
    async (sessionId: string): Promise<void> => {
      const before = await sessionRepository.getAll();
      const target = before.find((session) => session.id === sessionId);
      await scheduleActions.toggleSessionCompleted(sessionId);

      if (!target) {
        return;
      }

      const after = await sessionRepository.getAll();
      const updated = after.find((session) => session.id === sessionId);
      if (updated?.outcome) {
        try {
          await runLearningPipeline(target.date);
        } catch {
          // Learning failure must not fail completion toggle.
        }
      }
    },
    [runLearningPipeline, scheduleActions]
  );

  const plannerGateway = useMemo<PlannerGateway>(
    () => ({
      generateDayPlan: generateDayPlanAndApply,
      runMiddayAdjustment: runMiddayAdjustmentAndApply,
    }),
    [generateDayPlanAndApply, runMiddayAdjustmentAndApply]
  );

  return {
    scheduleActions,
    dayPlan: dayPlanHook,
    learning,
    plannerGateway,
    previewReplan,
    applyReplanPreview,
    previewFullReplan,
    applyFullReplanPreview,
    isPlannerRunning,
    saveReflection,
    completeSession,
  };
}

export type UseDayOrchestratorReturn = ReturnType<typeof useDayOrchestrator>;
