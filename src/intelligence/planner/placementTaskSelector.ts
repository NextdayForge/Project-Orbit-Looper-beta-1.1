import {
  Session,
  isActivePlacementSession,
  isMutableScheduleSession,
  isSessionCompleted,
} from '../../types/session';
import { Task } from '../../types/task';

const EXCLUDED_STATUSES = new Set<Task['status']>(['done', 'cancelled']);

/** Task IDs with a non-completed, active Session on the given date. */
export function getActiveSessionTaskIdsForDate(sessions: Session[], date: string): string[] {
  const ids = new Set<string>();

  for (const session of sessions) {
    if (
      session.date === date &&
      session.taskId != null &&
      isActivePlacementSession(session) &&
      session.status !== 'completed'
    ) {
      ids.add(session.taskId);
    }
  }

  return [...ids];
}

/** Sessions on the date that should block placement (not being replanned). */
export function getAnchorSessionsForReplan(
  sessions: Session[],
  date: string,
  replanTaskIds: string[]
): Session[] {
  const replanSet = new Set(replanTaskIds);

  return sessions.filter(
    (session) =>
      session.date === date &&
      session.taskId != null &&
      !replanSet.has(session.taskId) &&
      isActivePlacementSession(session) &&
      session.status !== 'completed'
  );
}

function scheduledMinutesForTask(
  taskId: string,
  planningDate: string,
  sessions: Session[]
): number {
  return sessions
    .filter(
      (session) =>
        session.taskId === taskId &&
        session.date !== planningDate &&
        isActivePlacementSession(session) &&
        isSessionCompleted(session)
    )
    .reduce((sum, session) => sum + session.estimatedMinutes, 0);
}

function remainingMinutesForTask(task: Task, planningDate: string, sessions: Session[]): number {
  const scheduledElsewhere = scheduledMinutesForTask(task.id, planningDate, sessions);
  return Math.max(0, task.estimatedMinutes - scheduledElsewhere);
}

/**
 * Selects Tasks eligible for placement on a given date.
 * Sessions on planningDate are ignored (applyDayPlan replaces that day's schedule).
 */
export function selectTasksForPlacement(tasks: Task[], sessions: Session[], date: string): Task[] {
  return tasks
    .filter((task) => {
      if (EXCLUDED_STATUSES.has(task.status)) {
        return false;
      }
      if (task.estimatedMinutes <= 0) {
        return false;
      }
      return remainingMinutesForTask(task, date, sessions) > 0;
    })
    .map((task) => ({
      ...task,
      estimatedMinutes: remainingMinutesForTask(task, date, sessions),
    }));
}

export function getRemainingMinutesForPlacement(
  task: Task,
  date: string,
  sessions: Session[]
): number {
  return remainingMinutesForTask(task, date, sessions);
}

/**
 * True when the task already has a mutable (not completed/cancelled/rescheduled)
 * session strictly after `dateKey`. Used to keep a task that's already homed on a
 * later day from also being placed on `dateKey` — without this, a task scheduled
 * for tomorrow (or later) could get a *second*, duplicate session placed today.
 */
export function hasFutureMutableSession(
  taskId: string,
  dateKey: string,
  sessions: Session[]
): boolean {
  return sessions.some(
    (session) =>
      session.taskId === taskId &&
      session.date > dateKey &&
      isMutableScheduleSession(session)
  );
}

/** Filters out task IDs that already have a mutable session on a later date (see `hasFutureMutableSession`). */
export function excludeTaskIdsWithFutureSessions(
  taskIds: string[],
  dateKey: string,
  sessions: Session[]
): string[] {
  return taskIds.filter((taskId) => !hasFutureMutableSession(taskId, dateKey, sessions));
}
