import { Session, isSessionCompleted } from '../../types/session';
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

export function titlesForTaskIds(taskIds: string[], tasks: Task[]): string[] {
  return taskIds
    .map((id) => tasks.find((task) => task.id === id)?.title)
    .filter((title): title is string => Boolean(title));
}
