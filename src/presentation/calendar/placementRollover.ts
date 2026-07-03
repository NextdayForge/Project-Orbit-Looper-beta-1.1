import { getRemainingMinutesForPlacement } from '../../intelligence/planner/placementTaskSelector';
import { DayPlan } from '../../types/dayPlan';
import { Session, isActivePlacementSession } from '../../types/session';
import { Task } from '../../types/task';
import { addDays, toDateKey } from '../../utils/time';

export type ApplyDayPlanResult = 'applied' | 'skipped_empty';

export interface ApplyDayPlanOptions {
  mode: 'replaceDay' | 'replaceTaskSessions';
  taskIds?: string[];
  replaceOnlyWhenPlaced?: boolean;
}

export interface PlanApplyOutcome {
  result: ApplyDayPlanResult;
  rolledTomorrowTitles: string[];
  bumpedTomorrowTitles: string[];
  carriedFromPastTitles: string[];
}

export function getUnplacedTaskIds(
  plan: DayPlan,
  taskIds: string[],
  tasks: Task[],
  sessions: Session[]
): string[] {
  return taskIds.filter((taskId) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) {
      return false;
    }

    const remaining = getRemainingMinutesForPlacement(task, plan.date, sessions);
    if (remaining <= 0) {
      return false;
    }

    const placedMinutes = plan.sessions
      .filter((session) => session.taskId === taskId)
      .reduce((sum, session) => sum + (session.endMinutes - session.startMinutes), 0);

    return placedMinutes < remaining - 5;
  });
}

/**
 * Bumps only as many lower-priority tasks as needed to free up `neededMinutes`,
 * least-important first — instead of sweeping every lower-priority task off the day.
 * Minutes-only heuristic: doesn't guarantee the freed time is one usable contiguous
 * gap (see SESSION_LOG 2026-07-02 for the considered — and deferred — iterative
 * regenerate-and-check alternative).
 */
export function findLowerPriorityTaskIdsToBump(
  date: string,
  sessions: Session[],
  tasks: Task[],
  urgentPriority: number,
  neededMinutes: number
): string[] {
  const candidateMinutesByTaskId = new Map<string, number>();

  for (const session of sessions) {
    if (session.date !== date || !session.taskId) {
      continue;
    }
    if (!isActivePlacementSession(session) || session.status === 'completed') {
      continue;
    }

    const task = tasks.find((item) => item.id === session.taskId);
    if (!task || task.priority <= urgentPriority) {
      continue;
    }

    const minutes = session.endMinutes - session.startMinutes;
    candidateMinutesByTaskId.set(
      task.id,
      (candidateMinutesByTaskId.get(task.id) ?? 0) + minutes
    );
  }

  const candidates = [...candidateMinutesByTaskId.entries()]
    .map(([taskId, minutes]) => ({
      taskId,
      minutes,
      priority: tasks.find((task) => task.id === taskId)?.priority ?? urgentPriority + 1,
    }))
    .sort((a, b) => b.priority - a.priority);

  const selected: string[] = [];
  let freedMinutes = 0;

  for (const candidate of candidates) {
    if (freedMinutes >= neededMinutes) {
      break;
    }
    selected.push(candidate.taskId);
    freedMinutes += candidate.minutes;
  }

  return selected;
}

function titlesFor(taskIds: string[], tasks: Task[]): string[] {
  return taskIds
    .map((id) => tasks.find((task) => task.id === id)?.title)
    .filter((title): title is string => Boolean(title));
}

/**
 * Sessions on `dateKey` for the bumped tasks — must be marked rescheduled so they don't
 * linger alongside the new session just added on tomorrow's plan (Session history rule:
 * never delete, mark rescheduled instead — see session.ts isActivePlacementSession()).
 */
function buildBumpedTodayRescheduleBatch(
  sessions: Session[],
  dateKey: string,
  taskIds: string[],
  now: string
): Session[] {
  const taskSet = new Set(taskIds);
  return sessions
    .filter(
      (session) =>
        session.date === dateKey &&
        session.taskId != null &&
        taskSet.has(session.taskId) &&
        isActivePlacementSession(session) &&
        session.status !== 'completed'
    )
    .map((session) => ({
      ...session,
      status: 'rescheduled' as const,
      rescheduledAt: now,
    }));
}

export function buildRolloverNotice(outcome: PlanApplyOutcome): string | null {
  const parts: string[] = [];

  if (outcome.bumpedTomorrowTitles.length > 0) {
    parts.push(
      `優先度の低い予定（${outcome.bumpedTomorrowTitles.join('、')}）を明日に移しました`
    );
  }
  if (outcome.rolledTomorrowTitles.length > 0) {
    parts.push(`配置できなかった予定（${outcome.rolledTomorrowTitles.join('、')}）を明日に繰り越しました`);
  }
  if (outcome.carriedFromPastTitles.length > 0) {
    parts.push(
      `未完了だった予定（${outcome.carriedFromPastTitles.join('、')}）を今日に繰り越しました`
    );
  }

  return parts.length > 0 ? `${parts.join('。')}。` : null;
}

interface PlacementRolloverDeps {
  targetDate: Date;
  taskIds: string[];
  tasks: Task[];
  sessions: Session[];
  isToday: boolean;
  generateDayPlan: (date: Date, taskIds: string[]) => Promise<DayPlan>;
  applyDayPlan: (plan: DayPlan, options: ApplyDayPlanOptions) => Promise<ApplyDayPlanResult>;
  reload: () => Promise<{ tasks: Task[]; sessions: Session[] }>;
  saveSessions: (sessions: Session[]) => Promise<unknown>;
}

export async function runPlacementWithRollover(
  deps: PlacementRolloverDeps
): Promise<PlanApplyOutcome> {
  const { targetDate, taskIds, isToday, generateDayPlan, applyDayPlan, reload, saveSessions } = deps;
  let { tasks, sessions } = deps;

  const dateKey = toDateKey(targetDate);
  const tomorrow = addDays(targetDate, 1);

  const bumpedTomorrowTitles: string[] = [];
  const rolledTomorrowTitles: string[] = [];

  let plan = await generateDayPlan(targetDate, taskIds);
  let unplaced = getUnplacedTaskIds(plan, taskIds, tasks, sessions);

  if (unplaced.length > 0) {
    const urgentPriority = Math.min(
      ...unplaced.map((id) => tasks.find((task) => task.id === id)?.priority ?? 5)
    );
    const neededMinutes = unplaced.reduce((sum, id) => {
      const task = tasks.find((item) => item.id === id);
      if (!task) {
        return sum;
      }
      const remaining = getRemainingMinutesForPlacement(task, dateKey, sessions);
      const placedMinutes = plan.sessions
        .filter((session) => session.taskId === id)
        .reduce((placedSum, session) => placedSum + (session.endMinutes - session.startMinutes), 0);
      return sum + Math.max(0, remaining - placedMinutes);
    }, 0);
    const toBump = findLowerPriorityTaskIdsToBump(dateKey, sessions, tasks, urgentPriority, neededMinutes);

    if (toBump.length > 0) {
      const bumpPlan = await generateDayPlan(tomorrow, toBump);
      await applyDayPlan(bumpPlan, {
        mode: 'replaceTaskSessions',
        taskIds: toBump,
      });
      bumpedTomorrowTitles.push(...titlesFor(toBump, tasks));

      // Without this, the bumped tasks' original sessions stay active on `dateKey`,
      // duplicating them alongside the new tomorrow session and keeping their old
      // slot "anchored" (occupied) when today's plan is regenerated below.
      const staleTodaySessions = buildBumpedTodayRescheduleBatch(
        sessions,
        dateKey,
        toBump,
        new Date().toISOString()
      );
      if (staleTodaySessions.length > 0) {
        await saveSessions(staleTodaySessions);
      }

      ({ tasks, sessions } = await reload());
      plan = await generateDayPlan(targetDate, taskIds);
      unplaced = getUnplacedTaskIds(plan, taskIds, tasks, sessions);
    }
  }

  await applyDayPlan(plan, {
    mode: 'replaceTaskSessions',
    taskIds,
    ...(isToday ? { replaceOnlyWhenPlaced: false } : {}),
  });

  unplaced = getUnplacedTaskIds(plan, taskIds, tasks, sessions);

  if (unplaced.length > 0) {
    const tomorrowPlan = await generateDayPlan(tomorrow, unplaced);
    await applyDayPlan(tomorrowPlan, {
      mode: 'replaceTaskSessions',
      taskIds: unplaced,
    });
    rolledTomorrowTitles.push(...titlesFor(unplaced, tasks));
  }

  if (
    plan.sessions.length > 0 ||
    rolledTomorrowTitles.length > 0 ||
    bumpedTomorrowTitles.length > 0
  ) {
    return {
      result: 'applied',
      rolledTomorrowTitles,
      bumpedTomorrowTitles,
      carriedFromPastTitles: [],
    };
  }

  return {
    result: 'skipped_empty',
    rolledTomorrowTitles,
    bumpedTomorrowTitles,
    carriedFromPastTitles: [],
  };
}
