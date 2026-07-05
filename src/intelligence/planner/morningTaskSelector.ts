import {
  getActiveSessionTaskIdsForDate,
  selectTasksForPlacement,
} from './placementTaskSelector';
import { getIncompleteTaskIdsBeforeDate } from './taskCarryOver';
import { Session } from '../../types/session';
import { Task } from '../../types/task';

export { getIncompleteTaskIdsBeforeDate } from './taskCarryOver';

/**
 * Resolves task IDs for morning / full-day replan — the union of:
 * 1. Today's active sessions (midday / existing plan)
 * 2. Placable tasks (any inbox/ready task with remaining time, whether or not
 *    it has ever been placed before)
 * 3. Incomplete tasks from any past day (carry-over)
 *
 * `placable` is always included, even when today already has active sessions.
 * A task that failed to be placed on a previous replan attempt (e.g. no
 * capacity anywhere) has no session on any date, so it isn't in `todayActive`
 * and isn't in `carryOver` (that only tracks tasks with an existing past
 * session) either — excluding `placable` here would make such a task
 * permanently unreachable by any future replan, since this app has no
 * separate backlog/all-tasks view to rediscover it from.
 */
export function resolveMorningReplanTaskIds(
  tasks: Task[],
  sessions: Session[],
  dateKey: string
): string[] {
  const carryOver = getIncompleteTaskIdsBeforeDate(sessions, dateKey);
  const todayActive = getActiveSessionTaskIdsForDate(sessions, dateKey);
  const placable = selectTasksForPlacement(tasks, sessions, dateKey).map((task) => task.id);

  return [...new Set([...todayActive, ...placable, ...carryOver])];
}
