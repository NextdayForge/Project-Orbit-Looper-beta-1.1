import {
  buildFutureSessionFreeBatch,
  buildRolloverConfirmNotice,
  buildRolloverNotice,
  findLowerPriorityTaskIdsToBump,
  resolveRolloverButtonLabel,
  runPlacementWithRollover,
  runRolloverConfirm,
  selectFutureSessionsToFree,
  sumPlacedMinutesByTask,
} from '../presentation/calendar/placementRollover';
import { resolveMorningReplanTaskIds } from '../intelligence/planner/morningTaskSelector';
import { DayPlan } from '../types/dayPlan';
import { toDateKey } from '../utils/time';
import { makeCapacity, makeSession, makeTask } from './fixtures';

const TODAY = '2026-07-04';
const TOMORROW = '2026-07-05';

describe('placementRollover', () => {
  describe('buildRolloverNotice', () => {
    it('reports automatic past carry-over and pending (not yet moved) tasks separately', () => {
      const notice = buildRolloverNotice({
        result: 'applied',
        carriedFromPastTitles: ['数学'],
        pendingRollover: [{ taskId: 'a', title: '英語' }],
        fromDateKey: TODAY,
      });
      expect(notice).toContain('数学');
      expect(notice).toContain('今日に繰り越しました');
      expect(notice).toContain('英語');
      expect(notice).toContain('入りきらなかった');
    });

    it('never claims anything was moved to tomorrow — only reports what is pending', () => {
      const notice = buildRolloverNotice({
        result: 'applied',
        carriedFromPastTitles: [],
        pendingRollover: [{ taskId: 'big', title: '巨大タスク' }],
        fromDateKey: TODAY,
      });
      expect(notice).toContain('巨大タスク');
      expect(notice).not.toContain('明日に');
      expect(notice).not.toContain('回しました');
    });

    it('returns null when nothing to report', () => {
      expect(
        buildRolloverNotice({
          result: 'applied',
          carriedFromPastTitles: [],
          pendingRollover: [],
          fromDateKey: '',
        })
      ).toBeNull();
    });

    it('truncates long title lists to "ほかN件"', () => {
      const notice = buildRolloverNotice({
        result: 'applied',
        carriedFromPastTitles: [],
        pendingRollover: ['a', 'b', 'c', 'd', 'e'].map((title) => ({ taskId: title, title })),
        fromDateKey: TODAY,
      });
      expect(notice).toContain('ほか2件');
    });
  });

  describe('resolveRolloverButtonLabel', () => {
    it('labels today\'s pending rollover "明日に回す"', () => {
      expect(resolveRolloverButtonLabel(TODAY, TODAY)).toBe('明日に回す');
    });

    it('labels a future date\'s pending rollover with the following day\'s M/D', () => {
      expect(resolveRolloverButtonLabel('2026-07-10', TODAY)).toBe('翌日（7/11）に回す');
    });
  });

  describe('buildRolloverConfirmNotice', () => {
    const requested = [
      { taskId: 'a', title: '英語' },
      { taskId: 'b', title: '数学' },
    ];

    it('reports everything rolled when nothing is still pending', () => {
      const text = buildRolloverConfirmNotice(requested, {
        result: 'applied',
        carriedFromPastTitles: [],
        pendingRollover: [],
        fromDateKey: '',
      });
      expect(text).toContain('明日に回しました');
      expect(text).toContain('英語');
      expect(text).toContain('数学');
      expect(text).not.toContain('保留');
    });

    it('reports both what rolled and what is still pending when tomorrow was also full for some', () => {
      const text = buildRolloverConfirmNotice(requested, {
        result: 'applied',
        carriedFromPastTitles: [],
        pendingRollover: [{ taskId: 'b', title: '数学' }],
        fromDateKey: TOMORROW,
      });
      expect(text).toContain('明日に回しました（英語）');
      expect(text).toContain('明日も空きがなく保留のままの予定があります（数学）');
    });
  });

  it('finds lower priority tasks to bump', () => {
    const low = makeTask({ id: 'low', priority: 5 });
    const high = makeTask({ id: 'high', priority: 1 });
    const session = makeSession({ taskId: 'low', date: '2026-06-28', status: 'planned' });

    const bumped = findLowerPriorityTaskIdsToBump('2026-06-28', [session], [low, high], 2, 30);
    expect(bumped).toEqual(['low']);
  });

  it('bumps only as many low-priority tasks as needed to free the required minutes', () => {
    const leastImportant = makeTask({ id: 'low-a', priority: 5 });
    const lessImportant = makeTask({ id: 'low-b', priority: 4 });
    const sessionA = makeSession({
      taskId: 'low-a',
      date: '2026-06-28',
      startMinutes: 9 * 60,
      endMinutes: 9 * 60 + 30,
      status: 'planned',
    });
    const sessionB = makeSession({
      taskId: 'low-b',
      date: '2026-06-28',
      startMinutes: 10 * 60,
      endMinutes: 10 * 60 + 30,
      status: 'planned',
    });

    const bumped = findLowerPriorityTaskIdsToBump(
      '2026-06-28',
      [sessionA, sessionB],
      [leastImportant, lessImportant],
      2,
      30
    );

    expect(bumped).toEqual(['low-a']);
  });

  it('bumps the least-important candidate first, then the next, until enough minutes are freed', () => {
    const leastImportant = makeTask({ id: 'low-a', priority: 5 });
    const lessImportant = makeTask({ id: 'low-b', priority: 4 });
    const sessionA = makeSession({
      taskId: 'low-a',
      date: '2026-06-28',
      startMinutes: 9 * 60,
      endMinutes: 9 * 60 + 30,
      status: 'planned',
    });
    const sessionB = makeSession({
      taskId: 'low-b',
      date: '2026-06-28',
      startMinutes: 10 * 60,
      endMinutes: 10 * 60 + 30,
      status: 'planned',
    });

    const bumped = findLowerPriorityTaskIdsToBump(
      '2026-06-28',
      [sessionA, sessionB],
      [leastImportant, lessImportant],
      2,
      50
    );

    expect(bumped).toEqual(['low-a', 'low-b']);
  });

  it('returns nothing to bump when no minutes are needed', () => {
    const low = makeTask({ id: 'low', priority: 5 });
    const session = makeSession({ taskId: 'low', date: '2026-06-28', status: 'planned' });

    const bumped = findLowerPriorityTaskIdsToBump('2026-06-28', [session], [low], 2, 0);
    expect(bumped).toEqual([]);
  });

  describe('runPlacementWithRollover — no bumping, no auto-roll (design principle 2)', () => {
    const DATE_KEY = '2026-06-28';

    function makePlan(overrides: Partial<DayPlan> = {}): DayPlan {
      return {
        date: DATE_KEY,
        dayType: 'NORMAL',
        capacity: makeCapacity(),
        sessions: [],
        calendarBlocks: [],
        reasonTags: [],
        generatedAt: '2026-06-28T00:00:00.000Z',
        ...overrides,
      };
    }

    it('never touches today\'s existing lower-priority sessions to make room (generateDayPlan/applyDayPlan called exactly once, for the target date only)', async () => {
      const urgent = makeTask({ id: 'urgent', priority: 1, estimatedMinutes: 60 });
      const low = makeTask({ id: 'low', priority: 5, estimatedMinutes: 30 });
      const lowSessionToday = makeSession({
        id: 'low-session-today',
        taskId: 'low',
        date: DATE_KEY,
        status: 'planned',
      });

      const plan = makePlan({
        sessions: [makeSession({ taskId: 'urgent', date: DATE_KEY, startMinutes: 0, endMinutes: 60 })],
      });
      const generateDayPlan = jest.fn().mockResolvedValue(plan);
      const applyDayPlan = jest.fn().mockResolvedValue('applied');

      const outcome = await runPlacementWithRollover({
        targetDate: new Date(`${DATE_KEY}T00:00:00`),
        taskIds: ['urgent'],
        tasks: [urgent, low],
        sessions: [lowSessionToday],
        isToday: true,
        generateDayPlan,
        applyDayPlan,
      });

      expect(generateDayPlan).toHaveBeenCalledTimes(1);
      expect(generateDayPlan).toHaveBeenCalledWith(expect.any(Date), ['urgent']);
      expect(applyDayPlan).toHaveBeenCalledTimes(1);
      expect(outcome.result).toBe('applied');
      expect(outcome.pendingRollover).toEqual([]);
      // low-session-today is simply absent from this plan/taskIds — nothing in this
      // function's contract rewrites or reschedules it.
    });

    it('returns what did not fit as pendingRollover instead of placing it on tomorrow', async () => {
      const ok = makeTask({ id: 'ok', title: 'OK Task', priority: 3, estimatedMinutes: 60 });
      const stuck = makeTask({ id: 'stuck', title: 'Stuck Task', priority: 5, estimatedMinutes: 90 });

      const generateDayPlan = jest.fn().mockResolvedValue(
        makePlan({
          sessions: [makeSession({ taskId: 'ok', date: DATE_KEY, startMinutes: 0, endMinutes: 60 })],
        })
      );
      const applyDayPlan = jest.fn().mockResolvedValue('applied');

      const outcome = await runPlacementWithRollover({
        targetDate: new Date(`${DATE_KEY}T00:00:00`),
        taskIds: ['ok', 'stuck'],
        tasks: [ok, stuck],
        sessions: [],
        isToday: true,
        generateDayPlan,
        applyDayPlan,
      });

      // Only one generateDayPlan call total — no second attempt against tomorrow.
      expect(generateDayPlan).toHaveBeenCalledTimes(1);
      expect(outcome.result).toBe('applied');
      expect(outcome.pendingRollover).toEqual([{ taskId: 'stuck', title: 'Stuck Task' }]);
      expect(outcome.fromDateKey).toBe(DATE_KEY);
    });

    it('is skipped_empty (not applied) when nothing at all could be placed', async () => {
      const stuck = makeTask({ id: 'stuck', title: 'Stuck Task', priority: 5, estimatedMinutes: 90 });
      const generateDayPlan = jest.fn().mockResolvedValue(makePlan({ sessions: [] }));
      const applyDayPlan = jest.fn().mockResolvedValue('skipped_empty');

      const outcome = await runPlacementWithRollover({
        targetDate: new Date(`${DATE_KEY}T00:00:00`),
        taskIds: ['stuck'],
        tasks: [stuck],
        sessions: [],
        isToday: true,
        generateDayPlan,
        applyDayPlan,
      });

      expect(outcome.result).toBe('skipped_empty');
      expect(outcome.pendingRollover).toEqual([{ taskId: 'stuck', title: 'Stuck Task' }]);
    });

    it('a pending task is still offered next time a plan is generated (not lost)', async () => {
      const stuck = makeTask({ id: 'stuck', title: 'Stuck Task', priority: 5, estimatedMinutes: 90 });
      const generateDayPlan = jest.fn().mockResolvedValue(makePlan({ sessions: [] }));
      const applyDayPlan = jest.fn().mockResolvedValue('skipped_empty');

      const outcome = await runPlacementWithRollover({
        targetDate: new Date(`${DATE_KEY}T00:00:00`),
        taskIds: ['stuck'],
        tasks: [stuck],
        sessions: [],
        isToday: true,
        generateDayPlan,
        applyDayPlan,
      });

      expect(outcome.pendingRollover.map((t) => t.taskId)).toEqual(['stuck']);
      // No session exists anywhere for 'stuck' (nothing was placed on tomorrow
      // automatically), so the next morning replan still picks it up.
      expect(resolveMorningReplanTaskIds([stuck], [], DATE_KEY)).toContain('stuck');
    });
  });

  describe('runRolloverConfirm — user-confirmed half of rollover', () => {
    const FROM_DATE_KEY = '2026-06-28';
    const NEXT_DATE_KEY = '2026-06-29';

    function makeTomorrowPlan(overrides: Partial<DayPlan> = {}): DayPlan {
      return {
        date: NEXT_DATE_KEY,
        dayType: 'NORMAL',
        capacity: makeCapacity(),
        sessions: [],
        calendarBlocks: [],
        reasonTags: [],
        generatedAt: '2026-06-28T00:00:00.000Z',
        ...overrides,
      };
    }

    it('places pending tasks on the day after fromDateKey', async () => {
      const task = makeTask({ id: 'a', title: 'A', priority: 3, estimatedMinutes: 30 });
      const generateDayPlan = jest.fn().mockResolvedValue(
        makeTomorrowPlan({
          sessions: [makeSession({ taskId: 'a', date: NEXT_DATE_KEY, startMinutes: 0, endMinutes: 30 })],
        })
      );
      const applyDayPlan = jest.fn().mockResolvedValue('applied');

      const outcome = await runRolloverConfirm({
        fromDateKey: FROM_DATE_KEY,
        taskIds: ['a'],
        tasks: [task],
        sessions: [],
        generateDayPlan,
        applyDayPlan,
      });

      expect(generateDayPlan).toHaveBeenCalledWith(expect.any(Date), ['a']);
      const [calledDate] = generateDayPlan.mock.calls[0] as [Date, string[]];
      expect(toDateKey(calledDate)).toBe(NEXT_DATE_KEY);
      expect(outcome.result).toBe('applied');
      expect(outcome.pendingRollover).toEqual([]);
    });

    it('does not claim a task "rolled to tomorrow" when tomorrow is also full — it stays pending (2026-07-06 regression guard)', async () => {
      // A task that fits nowhere must show up as still-pending, never as falsely
      // successful — otherwise it ends up with no session on any date, and since
      // there is no all-tasks/backlog view in this app, it becomes invisible.
      const ok = makeTask({ id: 'ok', title: 'OK Task', priority: 3, estimatedMinutes: 60 });
      const stuck = makeTask({ id: 'stuck', title: 'Stuck Task', priority: 5, estimatedMinutes: 90 });

      const generateDayPlan = jest.fn().mockResolvedValue(
        makeTomorrowPlan({
          sessions: [makeSession({ taskId: 'ok', date: NEXT_DATE_KEY, startMinutes: 0, endMinutes: 60 })],
        })
      );
      const applyDayPlan = jest.fn().mockResolvedValue('applied');

      const outcome = await runRolloverConfirm({
        fromDateKey: FROM_DATE_KEY,
        taskIds: ['ok', 'stuck'],
        tasks: [ok, stuck],
        sessions: [],
        generateDayPlan,
        applyDayPlan,
      });

      expect(outcome.result).toBe('applied');
      expect(outcome.pendingRollover).toEqual([{ taskId: 'stuck', title: 'Stuck Task' }]);
      expect(outcome.fromDateKey).toBe(NEXT_DATE_KEY);
    });
  });

  describe('pull-forward reconciliation (full replan pulling future work into today)', () => {
    it('sumPlacedMinutesByTask totals only mutable sessions on the given date for the given tasks', () => {
      const sessions = [
        makeSession({ taskId: 'a', date: TODAY, startMinutes: 540, endMinutes: 585 }), // 45 min
        makeSession({ taskId: 'a', date: TODAY, startMinutes: 600, endMinutes: 630 }), // 30 min
        makeSession({ taskId: 'a', date: TODAY, startMinutes: 700, endMinutes: 730, status: 'completed', completed: true }), // excluded (completed)
        makeSession({ taskId: 'b', date: TODAY, startMinutes: 540, endMinutes: 570 }), // not in taskIds
        makeSession({ taskId: 'a', date: TOMORROW, startMinutes: 540, endMinutes: 585 }), // wrong date
      ];

      const totals = sumPlacedMinutesByTask(sessions, TODAY, ['a']);
      expect(totals.get('a')).toBe(75);
      expect(totals.has('b')).toBe(false);
    });

    it('frees a future session fully covered by what was placed today', () => {
      const sessions = [
        makeSession({ id: 'future-1', taskId: 'a', date: TOMORROW, startMinutes: 540, endMinutes: 630 }), // 90 min
      ];
      const placed = new Map([['a', 90]]);

      const toFree = selectFutureSessionsToFree(sessions, TODAY, ['a'], placed);
      expect(toFree.map((s) => s.id)).toEqual(['future-1']);
    });

    it('only frees as many whole future sessions as fit the placed budget, leaving the rest untouched', () => {
      const sessions = [
        makeSession({ id: 'future-1', taskId: 'a', date: TOMORROW, startMinutes: 540, endMinutes: 585 }), // 45 min, earliest
        makeSession({ id: 'future-2', taskId: 'a', date: TOMORROW, startMinutes: 600, endMinutes: 645 }), // 45 min
      ];
      // Only 45 minutes of task 'a' actually landed today — just enough for one of the two sessions.
      const placed = new Map([['a', 45]]);

      const toFree = selectFutureSessionsToFree(sessions, TODAY, ['a'], placed);
      expect(toFree.map((s) => s.id)).toEqual(['future-1']);
    });

    it('frees nothing when nothing was placed today for that task', () => {
      const sessions = [
        makeSession({ id: 'future-1', taskId: 'a', date: TOMORROW }),
      ];
      const toFree = selectFutureSessionsToFree(sessions, TODAY, ['a'], new Map());
      expect(toFree).toEqual([]);
    });

    it('ignores future sessions for tasks outside taskIds, and past-dated sessions', () => {
      const sessions = [
        makeSession({ id: 'other-task', taskId: 'b', date: TOMORROW }),
        makeSession({ id: 'past', taskId: 'a', date: '2026-07-03' }),
      ];
      const toFree = selectFutureSessionsToFree(sessions, TODAY, ['a'], new Map([['a', 999]]));
      expect(toFree).toEqual([]);
    });

    it('buildFutureSessionFreeBatch marks the freed sessions rescheduled with a timestamp, without duplicating or losing the leftover', () => {
      const sessions = [
        // placed today: 45 min for task 'a'
        makeSession({ id: 'today-1', taskId: 'a', date: TODAY, startMinutes: 540, endMinutes: 585 }),
        // tomorrow had 90 min total across two sessions; only one (45 min) is now covered
        makeSession({ id: 'future-1', taskId: 'a', date: TOMORROW, startMinutes: 540, endMinutes: 585 }),
        makeSession({ id: 'future-2', taskId: 'a', date: TOMORROW, startMinutes: 600, endMinutes: 645 }),
      ];

      const batch = buildFutureSessionFreeBatch(sessions, TODAY, ['a'], '2026-07-04T09:00:00.000Z');

      expect(batch).toHaveLength(1);
      expect(batch[0].id).toBe('future-1');
      expect(batch[0].status).toBe('rescheduled');
      expect(batch[0].rescheduledAt).toBe('2026-07-04T09:00:00.000Z');
      // future-2 (the leftover that didn't fit today) is not in the batch — stays untouched on tomorrow.
    });
  });
});
