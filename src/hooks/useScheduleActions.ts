import { useCallback, useEffect, useState } from 'react';
import {
  calendarBlockRepository,
  flushLooperData,
  reflectionRepository,
  routineRepository,
  sessionRepository,
  taskRepository,
} from '../repositories';
import { RoutineTemplate } from '../types/routine';
import { deriveOutcome, shouldDeriveOutcome } from '../intelligence/outcome/OutcomeDeriver';
import { CalendarBlock, CalendarBlockSource, CalendarBlockType } from '../types/calendarBlock';
import { DayPlan } from '../types/dayPlan';
import { Reflection } from '../types/reflection';
import { DEFAULT_PRIORITY, TaskPriority } from '../types/schedule';
import { Session, SessionStatus, isInactiveScheduleSession } from '../types/session';
import { DEFAULT_TASK_CATEGORY, Task, TaskCategory, TaskStatus } from '../types/task';
import { generateId } from '../utils/time';
import { syncTasksAfterDayPlan } from '../presentation/calendar/syncTasksAfterDayPlan';
import {
  isRoutineVirtualBlock,
  withoutRoutineVirtualBlocks,
} from '../intelligence/planner/routineExpansion';

/** How applyDayPlan replaces persisted schedule data. */
export type ApplyDayPlanMode = 'replaceDay' | 'replaceTaskSessions';

export interface ApplyDayPlanOptions {
  mode: ApplyDayPlanMode;
  /** Required when mode is replaceTaskSessions. */
  taskIds?: string[];
  /**
   * When true (default), scoped replace only reschedules old sessions for tasks
   * that received a new session in the plan. Set false for shift-from-now.
   */
  replaceOnlyWhenPlaced?: boolean;
}

export type ApplyDayPlanResult = 'applied' | 'skipped_empty';

const AUX_BLOCK_MARGIN_MINUTES = 15;

/** Pure helper — builds the session batch persisted by applyDayPlan. */
export function buildDayPlanSessionBatch(
  plan: DayPlan,
  scopedToReschedule: Session[],
  now: string
): Session[] {
  const planSessionIds = new Set(plan.sessions.map((session) => session.id));

  const rescheduledSessions = scopedToReschedule
    .filter((session) => !planSessionIds.has(session.id))
    .map((session) => ({
      ...session,
      status: 'rescheduled' as SessionStatus,
      rescheduledAt: now,
    }));

  const planRescheduledSessions = plan.sessions.filter(
    (session) => session.status === 'rescheduled'
  );
  const activePlanSessions = plan.sessions.filter(
    (session) => session.status !== 'rescheduled'
  );

  return [...rescheduledSessions, ...planRescheduledSessions, ...activePlanSessions];
}

function isAuxBlockAdjacentToSessions(
  block: CalendarBlock,
  sessions: Session[],
  date: string,
  marginMinutes: number
): boolean {
  if (block.date !== date || block.type === 'fixed') {
    return false;
  }

  return sessions.some(
    (session) =>
      session.date === date &&
      block.endMinutes > session.startMinutes - marginMinutes &&
      block.startMinutes < session.endMinutes + marginMinutes
  );
}

function resolveSessionsToReschedule(
  allSessions: Session[],
  date: string,
  mode: ApplyDayPlanMode,
  taskIds: string[] | undefined
): Session[] {
  if (mode === 'replaceTaskSessions' && taskIds && taskIds.length > 0) {
    return allSessions.filter(
      (session) =>
        session.date === date &&
        session.taskId != null &&
        taskIds.includes(session.taskId) &&
        session.status !== 'completed' &&
        !session.completed &&
        session.status !== 'rescheduled' &&
        !(session.status === 'cancelled' && session.archived)
    );
  }

  return allSessions.filter(
    (session) =>
      session.date === date &&
      session.status !== 'completed' &&
      !session.completed &&
      session.status !== 'rescheduled' &&
      !(session.status === 'cancelled' && session.archived)
  );
}

function resolveBlocksToDelete(
  allBlocks: CalendarBlock[],
  date: string,
  mode: ApplyDayPlanMode,
  sessionsToReschedule: Session[],
  planSessions: Session[]
): CalendarBlock[] {
  if (mode === 'replaceTaskSessions') {
    return allBlocks.filter((block) =>
      isAuxBlockAdjacentToSessions(
        block,
        [...sessionsToReschedule, ...planSessions],
        date,
        AUX_BLOCK_MARGIN_MINUTES
      )
    );
  }

  return allBlocks.filter(
    (block) => block.date === date && block.type !== 'fixed'
  );
}

export type CreateTaskInput = {
  title: string;
  description?: string;
  category?: TaskCategory;
  estimatedMinutes: number;
  priority?: TaskPriority;
  deadline?: string;
  status?: TaskStatus;
  splittable?: boolean;
};

export type CreateSessionInput = {
  taskId?: string | null;
  date: string;
  startMinutes: number;
  endMinutes: number;
  estimatedMinutes?: number;
  actualStart?: string | null;
  actualEnd?: string | null;
  completedAt?: string | null;
  pauseCount?: number;
  status?: SessionStatus;
  aiGenerated?: boolean;
  completed?: boolean;
  reasonTags?: string[];
};

export type CreateCalendarBlockInput = {
  title: string;
  date: string;
  startMinutes: number;
  endMinutes: number;
  type: CalendarBlockType;
  locked?: boolean;
  source?: CalendarBlockSource;
  recurring?: boolean;
};

export type SaveReflectionInput = {
  id?: string;
  date: string;
  sessionId?: string | null;
  mood: number;
  energy: number;
  wins: string[];
  blockers: string[];
};

export type SaveRoutineInput = {
  id?: string;
  title: string;
  startMinutes: number;
  endMinutes: number;
  weekdays: number[];
  skipDates?: string[];
  enabled?: boolean;
};

function upsertReflection(items: Reflection[], reflection: Reflection): Reflection[] {
  const index = items.findIndex(
    (entry) => entry.id === reflection.id || entry.date === reflection.date
  );
  if (index >= 0) {
    const next = [...items];
    next[index] = reflection;
    return next;
  }
  return [...items, reflection];
}

/**
 * Task / Session / CalendarBlock / Reflection CRUD.
 * Repository is the source of truth; React state is a display cache synced via reloadFromRepository().
 */
export function useScheduleActions() {
  const [ready, setReady] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [calendarBlocks, setCalendarBlocks] = useState<CalendarBlock[]>([]);
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [routines, setRoutines] = useState<RoutineTemplate[]>([]);

  const reloadFromRepository = useCallback(async (): Promise<void> => {
    const [loadedTasks, loadedSessions, loadedBlocks, loadedReflections, loadedRoutines] =
      await Promise.all([
        taskRepository.getAll(),
        sessionRepository.getAll(),
        calendarBlockRepository.getAll(),
        reflectionRepository.getAll(),
        routineRepository.getAll(),
      ]);

    const persistedRoutineBlocks = loadedBlocks.filter(isRoutineVirtualBlock);
    if (persistedRoutineBlocks.length > 0) {
      await Promise.all(
        persistedRoutineBlocks.map((block) => calendarBlockRepository.delete(block.id))
      );
    }

    setTasks(loadedTasks);
    setSessions(loadedSessions);
    setCalendarBlocks(withoutRoutineVirtualBlocks(loadedBlocks));
    setReflections(loadedReflections);
    setRoutines(loadedRoutines);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        await reloadFromRepository();
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadFromRepository]);

  const createTask = useCallback(
    async (input: CreateTaskInput): Promise<Task> => {
      const now = new Date().toISOString();
      const task: Task = {
        id: generateId(),
        title: input.title,
        description: input.description,
        category: input.category ?? DEFAULT_TASK_CATEGORY,
        estimatedMinutes: input.estimatedMinutes,
        priority: input.priority ?? DEFAULT_PRIORITY,
        deadline: input.deadline,
        projectId: null,
        milestoneId: null,
        status: input.status ?? 'inbox',
        splittable: input.splittable ?? true,
        createdAt: now,
        updatedAt: now,
      };
      await taskRepository.save(task);
      await reloadFromRepository();
      return task;
    },
    [reloadFromRepository]
  );

  const updateTask = useCallback(
    async (task: Task): Promise<Task> => {
      const saved = await taskRepository.save({
        ...task,
        updatedAt: new Date().toISOString(),
      });
      await reloadFromRepository();
      return saved;
    },
    [reloadFromRepository]
  );

  const deleteTask = useCallback(
    async (id: string): Promise<void> => {
      const allSessions = await sessionRepository.getAll();
      const related = allSessions.filter((session) => session.taskId === id);
      const now = new Date().toISOString();

      await Promise.all(
        related.map((session) => {
          if (session.status === 'completed' || session.completed) {
            return sessionRepository.save({ ...session, archived: true });
          }
          // archived:true marks this as a user deletion (not a genuine skip/
          // reschedule) so isDayProgressSession/PlannerEvaluationService exclude
          // it from completion-rate and placement-quality stats instead of
          // counting a deleted task as an unfinished/failed one forever.
          return sessionRepository.save({
            ...session,
            status: 'cancelled',
            archived: true,
            rescheduledAt: session.rescheduledAt ?? now,
          });
        })
      );
      await taskRepository.delete(id);
      await reloadFromRepository();
    },
    [reloadFromRepository]
  );

  const createSession = useCallback(
    async (input: CreateSessionInput): Promise<Session> => {
      const session: Session = {
        id: generateId(),
        taskId: input.taskId ?? null,
        date: input.date,
        startMinutes: input.startMinutes,
        endMinutes: input.endMinutes,
        estimatedMinutes: input.estimatedMinutes ?? input.endMinutes - input.startMinutes,
        actualStart: input.actualStart ?? null,
        actualEnd: input.actualEnd ?? null,
        completedAt: input.completedAt ?? null,
        pauseCount: input.pauseCount ?? 0,
        status: input.status ?? 'planned',
        outcome: null,
        aiGenerated: input.aiGenerated ?? false,
        completed: input.completed ?? false,
        reasonTags: input.reasonTags ?? [],
        archived: false,
      };
      await sessionRepository.save(session);
      await reloadFromRepository();
      return session;
    },
    [reloadFromRepository]
  );

  const updateSession = useCallback(
    async (session: Session): Promise<Session> => {
      const outcome = shouldDeriveOutcome(session) ? deriveOutcome(session) : null;
      const saved = await sessionRepository.save({
        ...session,
        outcome,
      });
      await reloadFromRepository();
      return saved;
    },
    [reloadFromRepository]
  );

  const toggleSessionCompleted = useCallback(
    async (sessionId: string): Promise<void> => {
      const [allSessions, allTasks] = await Promise.all([
        sessionRepository.getAll(),
        taskRepository.getAll(),
      ]);
      const session = allSessions.find((item) => item.id === sessionId);
      if (!session) {
        return;
      }

      const isCompleted = session.status === 'completed';
      const now = new Date().toISOString();

      const updated: Session = isCompleted
        ? {
            ...session,
            status: 'planned',
            completedAt: null,
            actualEnd: null,
            outcome: null,
            completed: false,
          }
        : {
            ...session,
            status: 'completed',
            completedAt: now,
            actualEnd: session.actualStart ? now : null,
            completed: true,
          };

      await updateSession(updated);

      if (!session.taskId) {
        return;
      }

      const relatedSessions = allSessions
        .filter((item) => item.taskId === session.taskId)
        .map((item) => (item.id === sessionId ? updated : item));

      const hasIncomplete = relatedSessions.some(
        (item) => !isInactiveScheduleSession(item)
      );

      const task = allTasks.find((item) => item.id === session.taskId);
      if (!task) {
        return;
      }

      if (!isCompleted && !hasIncomplete) {
        await updateTask({ ...task, status: 'done' });
      } else if (isCompleted && task.status === 'done') {
        await updateTask({ ...task, status: 'scheduled' });
      }
    },
    [updateSession, updateTask]
  );

  const deleteSession = useCallback(
    async (id: string): Promise<void> => {
      const allSessions = await sessionRepository.getAll();
      const session = allSessions.find((item) => item.id === id);
      if (!session) {
        return;
      }

      if (session.status === 'completed' || session.completed) {
        await sessionRepository.save({ ...session, archived: true });
      } else {
        // archived:true marks this as a user deletion — see deleteTask for why.
        await sessionRepository.save({
          ...session,
          status: 'cancelled',
          archived: true,
          rescheduledAt: session.rescheduledAt ?? new Date().toISOString(),
        });
      }
      await reloadFromRepository();
    },
    [reloadFromRepository]
  );

  const createCalendarBlock = useCallback(
    async (input: CreateCalendarBlockInput): Promise<CalendarBlock> => {
      const block: CalendarBlock = {
        id: generateId(),
        title: input.title,
        date: input.date,
        startMinutes: input.startMinutes,
        endMinutes: input.endMinutes,
        type: input.type,
        locked: input.locked ?? input.type === 'fixed',
        source: input.source ?? 'user',
        recurring: input.recurring ?? false,
      };
      await calendarBlockRepository.save(block);
      await reloadFromRepository();
      return block;
    },
    [reloadFromRepository]
  );

  const updateCalendarBlock = useCallback(
    async (block: CalendarBlock): Promise<CalendarBlock> => {
      const saved = await calendarBlockRepository.save(block);
      await reloadFromRepository();
      return saved;
    },
    [reloadFromRepository]
  );

  const deleteCalendarBlock = useCallback(
    async (id: string): Promise<void> => {
      await calendarBlockRepository.delete(id);
      await reloadFromRepository();
    },
    [reloadFromRepository]
  );

  const applyDayPlan = useCallback(
    async (plan: DayPlan, options: ApplyDayPlanOptions): Promise<ApplyDayPlanResult> => {
      const nonFixedBlocks = plan.calendarBlocks.filter((block) => block.type !== 'fixed');
      if (plan.sessions.length === 0 && nonFixedBlocks.length === 0) {
        return 'skipped_empty';
      }

      if (
        options.mode === 'replaceTaskSessions' &&
        (!options.taskIds || options.taskIds.length === 0)
      ) {
        return 'skipped_empty';
      }

      const date = plan.date;
      const now = new Date().toISOString();
      const [allSessions, allBlocks] = await Promise.all([
        sessionRepository.getAll(),
        calendarBlockRepository.getAll(),
      ]);

      const sessionsToReschedule = resolveSessionsToReschedule(
        allSessions,
        date,
        options.mode,
        options.taskIds
      );

      const placedTaskIds = new Set(
        plan.sessions
          .map((session) => session.taskId)
          .filter((taskId): taskId is string => Boolean(taskId))
      );

      const replaceOnlyWhenPlaced = options.replaceOnlyWhenPlaced ?? true;
      const scopedToReschedule =
        options.mode === 'replaceTaskSessions' && replaceOnlyWhenPlaced
          ? sessionsToReschedule.filter(
              (session) => session.taskId != null && placedTaskIds.has(session.taskId)
            )
          : sessionsToReschedule;

      const sessionsToSave = buildDayPlanSessionBatch(plan, scopedToReschedule, now);

      let blocksToDelete = resolveBlocksToDelete(
        allBlocks,
        date,
        options.mode,
        scopedToReschedule,
        plan.sessions
      );

      if (options.mode === 'replaceTaskSessions' && options.replaceOnlyWhenPlaced === false) {
        const deleteIds = new Set(blocksToDelete.map((block) => block.id));
        for (const block of allBlocks) {
          if (block.date === date && block.type !== 'fixed' && !deleteIds.has(block.id)) {
            blocksToDelete.push(block);
            deleteIds.add(block.id);
          }
        }
      }

      await Promise.all(blocksToDelete.map((block) => calendarBlockRepository.delete(block.id)));

      const blocksToSave = withoutRoutineVirtualBlocks(plan.calendarBlocks);

      await Promise.all([
        sessionRepository.saveMany(sessionsToSave),
        calendarBlockRepository.saveMany(blocksToSave),
      ]);

      const allTasks = await taskRepository.getAll();
      await syncTasksAfterDayPlan(plan, allTasks, {
        updateTask: async (task) => {
          await taskRepository.save(task);
          return task;
        },
      });

      await flushLooperData();
      await reloadFromRepository();
      return 'applied';
    },
    [reloadFromRepository]
  );

  const saveReflection = useCallback(
    async (input: SaveReflectionInput): Promise<Reflection> => {
      const reflection: Reflection = {
        id: input.id ?? generateId(),
        date: input.date,
        sessionId: input.sessionId ?? null,
        mood: input.mood,
        energy: input.energy,
        wins: input.wins,
        blockers: input.blockers,
        createdAt: new Date().toISOString(),
      };
      const saved = await reflectionRepository.save(reflection);
      await reloadFromRepository();
      return saved;
    },
    [reloadFromRepository]
  );

  const saveRoutine = useCallback(
    async (input: SaveRoutineInput): Promise<RoutineTemplate> => {
      const now = new Date().toISOString();
      const existing = input.id
        ? await routineRepository.getById(input.id)
        : null;
      const routine: RoutineTemplate = {
        id: input.id ?? generateId(),
        title: input.title,
        startMinutes: input.startMinutes,
        endMinutes: input.endMinutes,
        weekdays: input.weekdays,
        skipDates: input.skipDates ?? existing?.skipDates ?? [],
        enabled: input.enabled ?? existing?.enabled ?? true,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      const saved = await routineRepository.save(routine);
      await reloadFromRepository();
      return saved;
    },
    [reloadFromRepository]
  );

  const deleteRoutine = useCallback(
    async (id: string): Promise<void> => {
      await routineRepository.delete(id);
      await reloadFromRepository();
    },
    [reloadFromRepository]
  );

  const flush = useCallback(async () => {
    await flushLooperData();
  }, []);

  const exportAppData = useCallback(async (): Promise<string> => {
    const { exportLooperBackup, shareLooperBackup } = await import('../storage/looperBackup');
    const { filename, json } = await exportLooperBackup();
    await shareLooperBackup(json, filename);
    return filename;
  }, []);

  const resetAllData = useCallback(async (): Promise<void> => {
    const { resetLooperAppData } = await import('../storage/looperBackup');
    await resetLooperAppData();
    await reloadFromRepository();
  }, [reloadFromRepository]);

  return {
    ready,
    tasks,
    sessions,
    calendarBlocks,
    reflections,
    routines,
    createTask,
    updateTask,
    deleteTask,
    createSession,
    updateSession,
    toggleSessionCompleted,
    deleteSession,
    createCalendarBlock,
    updateCalendarBlock,
    deleteCalendarBlock,
    applyDayPlan,
    reloadFromRepository,
    saveReflection,
    saveRoutine,
    deleteRoutine,
    flush,
    exportAppData,
    resetAllData,
  };
}

export type UseScheduleActionsReturn = ReturnType<typeof useScheduleActions>;
