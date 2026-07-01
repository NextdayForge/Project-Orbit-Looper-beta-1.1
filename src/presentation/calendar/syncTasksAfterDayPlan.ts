import { DayPlan } from '../../types/dayPlan';
import { Task } from '../../types/task';
import { CalendarEditorGateway } from './CalendarEditorAdapter';

/**
 * Marks Tasks linked to placed Sessions as scheduled after applyDayPlan.
 */
export async function syncTasksAfterDayPlan(
  plan: DayPlan,
  allTasks: Task[],
  gateway: Pick<CalendarEditorGateway, 'updateTask'>
): Promise<number> {
  const placedTaskIds = new Set(
    plan.sessions.map((session) => session.taskId).filter((taskId): taskId is string => taskId != null)
  );

  let updatedCount = 0;

  for (const taskId of placedTaskIds) {
    const task = allTasks.find((item) => item.id === taskId);
    if (!task || task.status === 'scheduled' || task.status === 'done' || task.status === 'cancelled') {
      continue;
    }

    await gateway.updateTask({
      ...task,
      status: 'scheduled',
    });
    updatedCount += 1;
  }

  return updatedCount;
}
