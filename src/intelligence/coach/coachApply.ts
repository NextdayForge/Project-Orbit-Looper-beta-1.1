import { CalendarEditorGateway } from '../../presentation/calendar/CalendarEditorAdapter';
import { PlannerGateway, ApplyDayPlanResult , runAiDayPlan } from '../../presentation/calendar/CalendarPlannerAdapter';
import { buildRolloverNotice } from '../../presentation/calendar/placementRollover';
import { resolveAiTaskInputs } from '../../presentation/calendar/resolveAiTasks';
import { sessionRepository, taskRepository } from '../../repositories';
import { AiTaskInput } from '../../types/schedule';
import { toDateKey } from '../../utils/time';
import { CoachScheduleAction, CoachScheduleFixedEventsAction, CoachScheduleTasksAction } from './types';

export interface ApplyCoachScheduleResult {
  result: ApplyDayPlanResult;
  message: string;
  taskTitles: string[];
}

export interface ApplyCoachScheduleOptions {
  date?: Date;
  defaultDurationMinutes: number;
  editorGateway: Pick<CalendarEditorGateway, 'createTask' | 'updateTask' | 'createCalendarBlock'>;
  plannerGateway: PlannerGateway;
}

export async function applyCoachScheduleAction(
  action: CoachScheduleAction,
  options: ApplyCoachScheduleOptions
): Promise<ApplyCoachScheduleResult> {
  if (action.kind === 'schedule_fixed_events') {
    return applyFixedEventsAction(action, options);
  }
  return applyTasksAction(action, options);
}

async function applyFixedEventsAction(
  action: CoachScheduleFixedEventsAction,
  options: ApplyCoachScheduleOptions
): Promise<ApplyCoachScheduleResult> {
  const targetDate = options.date ?? new Date();
  const dateKey = toDateKey(targetDate);
  const eventTitles = action.events.map((event) => event.title);

  if (action.events.length === 0) {
    return {
      result: 'skipped_empty',
      message: '固定予定を作成できませんでした。時刻ともう一度教えてください。',
      taskTitles: eventTitles,
    };
  }

  for (const event of action.events) {
    await options.editorGateway.createCalendarBlock({
      title: event.title,
      date: dateKey,
      startMinutes: event.startMinutes,
      endMinutes: event.endMinutes,
      type: 'fixed',
      locked: true,
      source: 'ai',
    });
  }

  return {
    result: 'applied',
    message: `今日の予定に固定で入れました。対象: ${eventTitles.join('、')}`,
    taskTitles: eventTitles,
  };
}

async function applyTasksAction(
  action: CoachScheduleTasksAction,
  options: ApplyCoachScheduleOptions
): Promise<ApplyCoachScheduleResult> {
  const targetDate = options.date ?? new Date();
  const dateKey = toDateKey(targetDate);
  const taskTitles = action.tasks.map((task) => task.title);

  const inputs: AiTaskInput[] = action.tasks.map((task) => ({
    title: task.title,
    priority: task.priority ?? 3,
  }));

  const [existingTasks, existingSessions] = await Promise.all([
    taskRepository.getAll(),
    sessionRepository.getAll(),
  ]);

  const { resolved, created, reused } = await resolveAiTaskInputs(
    inputs,
    dateKey,
    existingTasks,
    existingSessions,
    options.defaultDurationMinutes,
    options.editorGateway
  );

  if (resolved.length === 0) {
    return {
      result: 'skipped_empty',
      message: 'タスクを作成できませんでした。もう一度内容を教えてください。',
      taskTitles,
    };
  }

  const outcome = await runAiDayPlan(targetDate, options.plannerGateway, {
    taskIds: resolved.map((task) => task.id),
  });

  if (outcome.result === 'skipped_empty') {
    const createdNote = created > 0 ? `${created}件のタスクは追加済みです。` : '';
    return {
      result: outcome.result,
      message: `タスクは登録しましたが、今日も明日も配置できる時間がありませんでした。${createdNote}`,
      taskTitles,
    };
  }

  const rollover = buildRolloverNotice(outcome);
  const parts: string[] = [rollover ?? '今日の予定に組み込みました。'];
  if (created > 0) {
    parts.push(`新規${created}件`);
  }
  if (reused > 0) {
    parts.push(`既存${reused}件を再利用`);
  }
  parts.push(`対象: ${taskTitles.join('、')}`);

  return {
    result: outcome.result,
    message: parts.join(' '),
    taskTitles,
  };
}
