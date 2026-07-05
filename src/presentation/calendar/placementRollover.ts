import { getRemainingMinutesForPlacement } from '../../intelligence/planner/placementTaskSelector';
import { DayPlan } from '../../types/dayPlan';
import { Session, isActivePlacementSession, isMutableScheduleSession } from '../../types/session';
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
  /**
   * Tasks that could not be placed today OR tomorrow (tomorrow was also full).
   * These are NOT included in rolledTomorrowTitles — claiming a roll succeeded
   * when it didn't would silently orphan the task: it ends up with no session
   * on any date, and since there is no all-tasks/backlog view in this app, it
   * becomes invisible until the user happens to re-open AI schedule creation
   * and notices it missing.
   */
  stillUnplacedTitles: string[];
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

/** Minutes actually placed on `dateKey` for each of `taskIds`, from the current session list. */
export function sumPlacedMinutesByTask(
  sessions: Session[],
  dateKey: string,
  taskIds: string[]
): Map<string, number> {
  const taskSet = new Set(taskIds);
  const totals = new Map<string, number>();
  for (const session of sessions) {
    if (
      session.date === dateKey &&
      session.taskId != null &&
      taskSet.has(session.taskId) &&
      isMutableScheduleSession(session)
    ) {
      const minutes = session.endMinutes - session.startMinutes;
      totals.set(session.taskId, (totals.get(session.taskId) ?? 0) + minutes);
    }
  }
  return totals;
}

/**
 * When a full replan pulls a task's work forward onto `dateKey` (e.g. after
 * finishing today early and asking the AI to rebuild today's plan), any of that
 * task's already-existing sessions on FUTURE dates must be freed by exactly the
 * amount that was actually placed today — otherwise the same work is tracked
 * twice (today's new session AND the old future one) and the future session
 * never goes away.
 *
 * Future sessions are treated as whole, indivisible units (earliest first):
 * only as many of them as fit within what was placed today get freed
 * (`rescheduled`). Anything left over — because today didn't have room for it —
 * is untouched and stays exactly where it was on its future date. This mirrors
 * `findLowerPriorityTaskIdsToBump`'s minutes-only, whole-session approach.
 */
export function selectFutureSessionsToFree(
  sessions: Session[],
  dateKey: string,
  taskIds: string[],
  placedMinutesByTask: Map<string, number>
): Session[] {
  const taskSet = new Set(taskIds);
  const futureByTask = new Map<string, Session[]>();

  for (const session of sessions) {
    if (
      session.date > dateKey &&
      session.taskId != null &&
      taskSet.has(session.taskId) &&
      isMutableScheduleSession(session)
    ) {
      const list = futureByTask.get(session.taskId) ?? [];
      list.push(session);
      futureByTask.set(session.taskId, list);
    }
  }

  const toFree: Session[] = [];
  for (const [taskId, futureSessions] of futureByTask) {
    const budget = placedMinutesByTask.get(taskId) ?? 0;
    if (budget <= 0) {
      continue;
    }

    const sorted = [...futureSessions].sort(
      (a, b) => a.date.localeCompare(b.date) || a.startMinutes - b.startMinutes
    );

    let used = 0;
    for (const session of sorted) {
      const minutes = session.endMinutes - session.startMinutes;
      if (used + minutes > budget + 5) {
        break;
      }
      toFree.push(session);
      used += minutes;
    }
  }

  return toFree;
}

/**
 * Builds the rescheduled-session batch to persist after a full replan, freeing
 * future sessions covered by what was placed on `dateKey` (see
 * `selectFutureSessionsToFree`). Returns `[]` when nothing needs freeing.
 */
export function buildFutureSessionFreeBatch(
  sessions: Session[],
  dateKey: string,
  taskIds: string[],
  now: string
): Session[] {
  const placedMinutesByTask = sumPlacedMinutesByTask(sessions, dateKey, taskIds);
  const toFree = selectFutureSessionsToFree(sessions, dateKey, taskIds, placedMinutesByTask);
  return toFree.map((session) => ({
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
  if (outcome.stillUnplacedTitles.length > 0) {
    parts.push(
      `空き時間が見つからず保留にした予定（${outcome.stillUnplacedTitles.join('、')}）があります。所要時間を短くするか、別の日を指定してください`
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

  const stillUnplacedTitles: string[] = [];

  if (unplaced.length > 0) {
    const tomorrowPlan = await generateDayPlan(tomorrow, unplaced);
    await applyDayPlan(tomorrowPlan, {
      mode: 'replaceTaskSessions',
      taskIds: unplaced,
    });

    // Tomorrow can also be full. Verify each task actually got a session there
    // before reporting it as "rolled to tomorrow" — claiming success for a task
    // that landed nowhere would leave it invisible (no session on any date, and
    // this app has no all-tasks/backlog view to fall back on).
    const stillUnplacedOnTomorrow = new Set(
      getUnplacedTaskIds(tomorrowPlan, unplaced, tasks, sessions)
    );
    const actuallyRolled = unplaced.filter((id) => !stillUnplacedOnTomorrow.has(id));

    rolledTomorrowTitles.push(...titlesFor(actuallyRolled, tasks));
    stillUnplacedTitles.push(...titlesFor([...stillUnplacedOnTomorrow], tasks));
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
      stillUnplacedTitles,
    };
  }

  return {
    result: 'skipped_empty',
    rolledTomorrowTitles,
    bumpedTomorrowTitles,
    carriedFromPastTitles: [],
    stillUnplacedTitles,
  };
}
