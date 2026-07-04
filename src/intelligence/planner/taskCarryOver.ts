import { Session, isMutableScheduleSession, isSessionCompleted } from '../../types/session';
import { Task } from '../../types/task';

function isIncompleteCarryOverSession(session: Session): boolean {
  return (
    session.taskId != null &&
    !isSessionCompleted(session) &&
    session.status !== 'rescheduled' &&
    session.status !== 'cancelled' &&
    session.status !== 'skipped'
  );
}

/** Task IDs with incomplete sessions strictly before the planning date. */
export function getIncompleteTaskIdsBeforeDate(sessions: Session[], beforeDateKey: string): string[] {
  const ids = new Set<string>();
  for (const session of sessions) {
    if (session.date < beforeDateKey && session.taskId && isIncompleteCarryOverSession(session)) {
      ids.add(session.taskId);
    }
  }
  return [...ids];
}

export function buildPastIncompleteRescheduleBatch(
  sessions: Session[],
  beforeDateKey: string,
  taskIds: string[],
  now: string
): Session[] {
  const taskSet = new Set(taskIds);
  return sessions
    .filter(
      (session) =>
        session.date < beforeDateKey &&
        session.taskId != null &&
        taskSet.has(session.taskId) &&
        isIncompleteCarryOverSession(session)
    )
    .map((session) => ({
      ...session,
      status: 'rescheduled' as const,
      rescheduledAt: now,
    }));
}

/**
 * Of the carry-over task IDs, the ones that now have an active (mutable) session
 * on `dateKey` or any later date — i.e. they've been re-placed forward (today, or
 * rolled/bumped to a future day). Only these should have their stale past-day
 * sessions rescheduled, so a task is never left lingering on a past date once it
 * has a new home going forward. (Guarding on "re-homed" avoids dropping a task
 * that couldn't be placed anywhere.)
 */
export function selectRehomedCarryOverTaskIds(
  sessions: Session[],
  dateKey: string,
  carryOverTaskIds: string[]
): string[] {
  const carrySet = new Set(carryOverTaskIds);
  const rehomed = new Set<string>();
  for (const session of sessions) {
    if (
      session.date >= dateKey &&
      session.taskId != null &&
      carrySet.has(session.taskId) &&
      isMutableScheduleSession(session)
    ) {
      rehomed.add(session.taskId);
    }
  }
  return [...rehomed];
}

export function titlesForTaskIds(taskIds: string[], tasks: Task[]): string[] {
  return taskIds
    .map((id) => tasks.find((task) => task.id === id)?.title)
    .filter((title): title is string => Boolean(title));
}
