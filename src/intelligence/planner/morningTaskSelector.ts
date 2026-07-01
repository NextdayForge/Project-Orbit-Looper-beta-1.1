import {
  getActiveSessionTaskIdsForDate,
  selectTasksForPlacement,
} from './placementTaskSelector';
import { getIncompleteTaskIdsBeforeDate } from './taskCarryOver';
import { Session } from '../../types/session';
import { Task } from '../../types/task';

export { getIncompleteTaskIdsBeforeDate } from './taskCarryOver';

/**
 * Resolves task IDs for morning / full-day replan:
 * 1. Today's active sessions (midday / existing plan)
 * 2. Placable tasks (pre-registered for today)
 * 3. Incomplete tasks from any past day (carry-over)
 */
export function resolveMorningReplanTaskIds(
  tasks: Task[],
  sessions: Session[],
  dateKey: string
): string[] {
  const carryOver = getIncompleteTaskIdsBeforeDate(sessions, dateKey);
  const todayActive = getActiveSessionTaskIdsForDate(sessions, dateKey);

  if (todayActive.length > 0) {
    return [...new Set([...todayActive, ...carryOver])];
  }

  const placable = selectTasksForPlacement(tasks, sessions, dateKey).map((task) => task.id);

  return [...new Set([...placable, ...carryOver])];
}
