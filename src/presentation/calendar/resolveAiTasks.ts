import { AiTaskInput } from '../../types/schedule';

import { Session } from '../../types/session';

import { Task, TaskCategory, TaskStatus } from '../../types/task';

import { normalizeTaskTitle } from '../../utils/taskTitle';

import { taskDurationEstimator } from '../../intelligence/taskEstimate/TaskDurationEstimator';
import { scaleMinutesForEstimation } from '../../intelligence/planner/estimationScale';
import { userModelRepository } from '../../repositories';

import { CalendarEditorGateway } from './CalendarEditorAdapter';



const REUSABLE_STATUSES = new Set<TaskStatus>(['inbox', 'ready']);



export { normalizeTaskTitle };


export interface ResolveAiTaskInputsResult {

  resolved: Task[];

  created: number;

  reused: number;

}



function findExistingTaskForAiInput(

  existingTasks: Task[],

  existingSessions: Session[],

  targetDate: string,

  normalizedTitle: string

): Task | null {

  const candidates = existingTasks.filter(

    (task) =>

      REUSABLE_STATUSES.has(task.status) && normalizeTaskTitle(task.title) === normalizedTitle

  );



  if (candidates.length === 0) {

    return null;

  }



  const onTargetDate = candidates.filter((task) =>

    existingSessions.some(

      (session) =>

        session.date === targetDate && session.taskId === task.id && session.status !== 'completed'

    )

  );



  const pool = onTargetDate.length > 0 ? onTargetDate : candidates;



  return pool.reduce((latest, task) =>

    task.updatedAt > latest.updatedAt ? task : latest

  );

}



/**

 * Resolves AI modal inputs to inbox/ready Tasks or creates new ones.

 * Reuses existing Tasks without mutating them (Principle 2).

 */

export async function resolveAiTaskInputs(

  inputs: AiTaskInput[],

  targetDate: string,

  existingTasks: Task[],

  existingSessions: Session[],

  defaultEstimatedMinutes: number,

  gateway: Pick<CalendarEditorGateway, 'createTask' | 'updateTask'>

): Promise<ResolveAiTaskInputsResult> {

  const resolved: Task[] = [];

  let created = 0;

  let reused = 0;

  const userModel = await userModelRepository.get();

  const knownTasks = [...existingTasks];
  const pendingInputs: Array<{
    title: string;
    priority: typeof inputs[0]['priority'];
    estimatedMinutes?: number;
  }> = [];

  for (const input of inputs) {
    const normalizedTitle = normalizeTaskTitle(input.title);
    if (!normalizedTitle) {
      continue;
    }

    const existing = findExistingTaskForAiInput(
      knownTasks,
      existingSessions,
      targetDate,
      normalizedTitle
    );
    if (existing) {
      const userSpecifiedMinutes =
        input.estimatedMinutes && input.estimatedMinutes > 0 ? input.estimatedMinutes : null;

      if (userSpecifiedMinutes == null) {
        resolved.push(existing);
      } else {
        // A freshly re-entered duration is the user correcting the task right now —
        // distinct from AI/estimation silently rewriting it (Principle 2 still holds).
        const scaledMinutes = scaleMinutesForEstimation(
          userSpecifiedMinutes,
          existing.category,
          userModel.estimationFactor
        );
        resolved.push(
          scaledMinutes === existing.estimatedMinutes
            ? existing
            : await gateway.updateTask({
                ...existing,
                estimatedMinutes: scaledMinutes,
                splittable: scaledMinutes > userModel.focusLength,
                updatedAt: new Date().toISOString(),
              })
        );
      }
      reused += 1;
      continue;
    }

    pendingInputs.push({
      title: normalizedTitle,
      priority: input.priority,
      estimatedMinutes: input.estimatedMinutes,
    });
  }

  // User-specified durations bypass estimation entirely — never overwritten by AI/keyword guesses.
  const inputsNeedingEstimate = pendingInputs.filter(
    (item) => !(item.estimatedMinutes && item.estimatedMinutes > 0)
  );
  const estimates = await taskDurationEstimator.estimateBatch(
    inputsNeedingEstimate.map((item) => ({
      title: item.title,
      defaultMinutes: defaultEstimatedMinutes,
    }))
  );

  for (const item of pendingInputs) {
    const userSpecifiedMinutes =
      item.estimatedMinutes && item.estimatedMinutes > 0 ? item.estimatedMinutes : null;

    const estimate: { estimatedMinutes: number; category: TaskCategory } =
      userSpecifiedMinutes != null
        ? { estimatedMinutes: userSpecifiedMinutes, category: 'general' }
        : estimates.get(item.title) ?? {
            estimatedMinutes: defaultEstimatedMinutes,
            category: 'general',
          };
    const scaledMinutes = scaleMinutesForEstimation(
      estimate.estimatedMinutes,
      estimate.category,
      userModel.estimationFactor
    );

    const task = await gateway.createTask({
      title: item.title,
      priority: item.priority,
      estimatedMinutes: scaledMinutes,
      category: estimate.category,
      status: 'inbox',
      splittable: scaledMinutes > userModel.focusLength,
    });
    resolved.push(task);
    created += 1;
    knownTasks.push(task);
  }

  return { resolved, created, reused };
}

