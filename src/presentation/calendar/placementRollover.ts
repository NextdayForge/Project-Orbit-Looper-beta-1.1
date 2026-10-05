import { getRemainingMinutesForPlacement } from '../../intelligence/planner/placementTaskSelector';
import { DayPlan } from '../../types/dayPlan';
import { Session, isActivePlacementSession, isMutableScheduleSession } from '../../types/session';
import { Task } from '../../types/task';
import { addDays, parseDateKey, toDateKey } from '../../utils/time';

export type ApplyDayPlanResult = 'applied' | 'skipped_empty';

export interface ApplyDayPlanOptions {
  mode: 'replaceDay' | 'replaceTaskSessions';
  taskIds?: string[];
  replaceOnlyWhenPlaced?: boolean;
}

export interface PendingRolloverTask {
  taskId: string;
  title: string;
}

export interface PlanApplyOutcome {
  result: ApplyDayPlanResult;
  carriedFromPastTitles: string[];
  /**
   * Tasks that did not fit on `fromDateKey` and have NOT been moved anywhere —
   * the app no longer rolls these to tomorrow on its own (design principle 2:
   * moving a Session to a different day changes "what day this happens on",
   * which needs the user's confirmation, same as bumping an existing one does).
   * Surfaced in a notice with an explicit "roll to tomorrow" action
   * (`PlannerGateway.confirmRollover`); dismissing the notice leaves them pending
   * — not lost, since `resolveMorningReplanTaskIds` always includes placable
   * tasks, so they're offered again next time a plan is generated.
   */
  pendingRollover: PendingRolloverTask[];
  /** The date `pendingRollover` is pending from (empty string when pendingRollover is empty). */
  fromDateKey: string;
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

/**
 * Sessions on `dateKey` for the bumped tasks — must be marked rescheduled so they don't
 * linger alongside the new session just added on tomorrow's plan (Session history rule:
 * never delete, mark rescheduled instead — see session.ts isActivePlacementSession()).
 *
 * Not currently called from `runPlacementWithRollover` (bumping today's existing
 * plan without confirmation was removed — design principle 2). Kept, and exported,
 * for the next step: offering "free up time by moving these lower-priority items
 * to tomorrow" as a user-confirmed proposal, which will reuse this batch builder.
 */
export function buildBumpedTodayRescheduleBatch(
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

const MAX_TITLES_SHOWN = 3;

function formatTitleList(titles: string[]): string {
  if (titles.length <= MAX_TITLES_SHOWN) {
    return titles.join('、');
  }
  const shown = titles.slice(0, MAX_TITLES_SHOWN);
  return `${shown.join('、')}、ほか${titles.length - MAX_TITLES_SHOWN}件`;
}

/**
 * Notice shown right after generating/updating a plan. Only reports what actually
 * happened automatically (today's carry-over from past incomplete sessions) and
 * what's left pending (didn't fit `fromDateKey`, not moved anywhere yet) — never
 * claims a rollover happened, since none does without the user confirming it via
 * the notice's action button (see `resolveRolloverButtonLabel` / `PlannerGateway.confirmRollover`).
 */
export function buildRolloverNotice(outcome: PlanApplyOutcome): string | null {
  const parts: string[] = [];

  if (outcome.carriedFromPastTitles.length > 0) {
    parts.push(
      `未完了だった予定（${formatTitleList(outcome.carriedFromPastTitles)}）を今日に繰り越しました`
    );
  }
  if (outcome.pendingRollover.length > 0) {
    parts.push(
      `空き時間に入りきらなかった予定があります（${formatTitleList(
        outcome.pendingRollover.map((task) => task.title)
      )}）`
    );
  }

  return parts.length > 0 ? `${parts.join('。')}。` : null;
}

/** Label for the notice's rollover action button — "明日に回す" for today, "翌日（M/D）に回す" otherwise. */
export function resolveRolloverButtonLabel(fromDateKey: string, todayDateKey: string): string {
  if (fromDateKey === todayDateKey) {
    return '明日に回す';
  }
  const target = addDays(parseDateKey(fromDateKey), 1);
  return `翌日（${target.getMonth() + 1}/${target.getDate()}）に回す`;
}

/**
 * Notice shown after the user presses the rollover action button. Compares what was
 * requested against what's still pending in the confirm outcome: anything no longer
 * pending made it onto tomorrow; anything still pending didn't fit there either
 * (tomorrow was also full) and stays pending — offered again next time.
 */
export function buildRolloverConfirmNotice(
  requested: PendingRolloverTask[],
  outcome: PlanApplyOutcome
): string {
  const stillPendingIds = new Set(outcome.pendingRollover.map((task) => task.taskId));
  const rolledTitles = requested
    .filter((task) => !stillPendingIds.has(task.taskId))
    .map((task) => task.title);

  const parts: string[] = [];
  if (rolledTitles.length > 0) {
    parts.push(`明日に回しました（${formatTitleList(rolledTitles)}）`);
  }
  if (outcome.pendingRollover.length > 0) {
    parts.push(
      `明日も空きがなく保留のままの予定があります（${formatTitleList(
        outcome.pendingRollover.map((task) => task.title)
      )}）`
    );
  }

  return parts.length > 0 ? `${parts.join('。')}。` : '予定を更新しました。';
}

function toPendingRolloverTasks(taskIds: string[], tasks: Task[]): PendingRolloverTask[] {
  return taskIds
    .map((taskId) => ({ taskId, title: tasks.find((task) => task.id === taskId)?.title ?? '' }))
    .filter((task): task is PendingRolloverTask => task.title.length > 0);
}

interface PlacementRolloverDeps {
  targetDate: Date;
  taskIds: string[];
  tasks: Task[];
  sessions: Session[];
  isToday: boolean;
  generateDayPlan: (date: Date, taskIds: string[]) => Promise<DayPlan>;
  applyDayPlan: (plan: DayPlan, options: ApplyDayPlanOptions) => Promise<ApplyDayPlanResult>;
}

/**
 * Places `taskIds` on `targetDate` only — never touches today's existing plan to make
 * room (no bumping) and never auto-moves what didn't fit to tomorrow (no auto-roll).
 * Both of those are now user-confirmed actions: bumping is deferred to a future
 * "free up time" proposal (see `findLowerPriorityTaskIdsToBump` / `buildBumpedTodayRescheduleBatch`),
 * and rolling over is `PlannerGateway.confirmRollover`, surfaced via this outcome's
 * `pendingRollover` and a notice action button (`resolveRolloverButtonLabel`).
 */
export async function runPlacementWithRollover(
  deps: PlacementRolloverDeps
): Promise<PlanApplyOutcome> {
  const { targetDate, taskIds, tasks, sessions, isToday, generateDayPlan, applyDayPlan } = deps;

  const dateKey = toDateKey(targetDate);

  const plan = await generateDayPlan(targetDate, taskIds);

  await applyDayPlan(plan, {
    mode: 'replaceTaskSessions',
    taskIds,
    ...(isToday ? { replaceOnlyWhenPlaced: false } : {}),
  });

  const unplaced = getUnplacedTaskIds(plan, taskIds, tasks, sessions);
  const pendingRollover = toPendingRolloverTasks(unplaced, tasks);

  return {
    result: plan.sessions.length > 0 ? 'applied' : 'skipped_empty',
    carriedFromPastTitles: [],
    pendingRollover,
    fromDateKey: pendingRollover.length > 0 ? dateKey : '',
  };
}

interface RolloverConfirmDeps {
  fromDateKey: string;
  taskIds: string[];
  tasks: Task[];
  sessions: Session[];
  generateDayPlan: (date: Date, taskIds: string[]) => Promise<DayPlan>;
  applyDayPlan: (plan: DayPlan, options: ApplyDayPlanOptions) => Promise<ApplyDayPlanResult>;
}

/**
 * The user-confirmed half of rollover: places `taskIds` (from `runPlacementWithRollover`'s
 * `pendingRollover`) on the day after `fromDateKey`. Carries forward the 2026-07-06
 * regression guard — tomorrow can also be full, so each task's new session is verified
 * before it's dropped from the still-pending list; a task that doesn't fit there either
 * stays in `pendingRollover` (now dated tomorrow) rather than being silently lost.
 */
export async function runRolloverConfirm(deps: RolloverConfirmDeps): Promise<PlanApplyOutcome> {
  const { fromDateKey, taskIds, tasks, sessions, generateDayPlan, applyDayPlan } = deps;

  const tomorrow = addDays(parseDateKey(fromDateKey), 1);
  const tomorrowKey = toDateKey(tomorrow);

  const plan = await generateDayPlan(tomorrow, taskIds);
  await applyDayPlan(plan, { mode: 'replaceTaskSessions', taskIds });

  const stillUnplaced = getUnplacedTaskIds(plan, taskIds, tasks, sessions);
  const pendingRollover = toPendingRolloverTasks(stillUnplaced, tasks);

  return {
    result: plan.sessions.length > 0 ? 'applied' : 'skipped_empty',
    carriedFromPastTitles: [],
    pendingRollover,
    fromDateKey: pendingRollover.length > 0 ? tomorrowKey : '',
  };
}
