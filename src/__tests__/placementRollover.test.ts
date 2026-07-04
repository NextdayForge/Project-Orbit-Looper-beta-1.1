import {
  buildFutureSessionFreeBatch,
  buildRolloverNotice,
  findLowerPriorityTaskIdsToBump,
  runPlacementWithRollover,
  selectFutureSessionsToFree,
  sumPlacedMinutesByTask,
} from '../presentation/calendar/placementRollover';
import { DayPlan } from '../types/dayPlan';
import { Session } from '../types/session';
import { makeCapacity, makeSession, makeTask } from './fixtures';

const TODAY = '2026-07-04';
const TOMORROW = '2026-07-05';

describe('placementRollover', () => {
  it('buildRolloverNotice formats bumped and rolled titles', () => {
    const notice = buildRolloverNotice({
      result: 'applied',
      bumpedTomorrowTitles: ['メール整理'],
      rolledTomorrowTitles: ['英語'],
      carriedFromPastTitles: ['数学'],
    });
    expect(notice).toContain('メール整理');
    expect(notice).toContain('英語');
    expect(notice).toContain('数学');
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

  describe('runPlacementWithRollover', () => {
    const DATE_KEY = '2026-06-28';
    const TOMORROW_KEY = '2026-06-29';

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

    it('reschedules the bumped task\'s stale session on today instead of leaving a duplicate', async () => {
      const urgent = makeTask({ id: 'urgent', priority: 1, estimatedMinutes: 60 });
      const low = makeTask({ id: 'low', priority: 5, estimatedMinutes: 30 });
      const lowSessionToday = makeSession({
        id: 'low-session-today',
        taskId: 'low',
        date: DATE_KEY,
        status: 'planned',
      });

      const applyDayPlan = jest.fn().mockResolvedValue('applied');
      const saveSessions = jest.fn().mockResolvedValue(undefined);
      const reload = jest.fn().mockResolvedValue({
        tasks: [urgent, low],
        sessions: [
          { ...lowSessionToday, status: 'rescheduled' },
          makeSession({ taskId: 'low', date: TOMORROW_KEY, status: 'planned' }),
        ],
      });

      const generateDayPlan = jest
        .fn()
        .mockImplementationOnce(async () => makePlan({ date: DATE_KEY, sessions: [] }))
        .mockImplementationOnce(async () =>
          makePlan({
            date: TOMORROW_KEY,
            sessions: [makeSession({ taskId: 'low', date: TOMORROW_KEY, status: 'planned' })],
          })
        )
        .mockImplementationOnce(async () =>
          makePlan({
            date: DATE_KEY,
            sessions: [
              makeSession({ taskId: 'urgent', date: DATE_KEY, startMinutes: 0, endMinutes: 60 }),
            ],
          })
        );

      const outcome = await runPlacementWithRollover({
        targetDate: new Date(`${DATE_KEY}T00:00:00`),
        taskIds: ['urgent'],
        tasks: [urgent, low],
        sessions: [lowSessionToday],
        isToday: true,
        generateDayPlan,
        applyDayPlan,
        reload,
        saveSessions,
      });

      expect(saveSessions).toHaveBeenCalledTimes(1);
      const [savedBatch] = saveSessions.mock.calls[0] as [Session[]];
      expect(savedBatch).toHaveLength(1);
      expect(savedBatch[0].id).toBe('low-session-today');
      expect(savedBatch[0].status).toBe('rescheduled');
      expect(outcome.bumpedTomorrowTitles).toContain('Task');
    });

    it('does not call saveSessions when nothing needs to be bumped', async () => {
      const task = makeTask({ id: 'solo', priority: 3, estimatedMinutes: 30 });
      const generateDayPlan = jest.fn().mockResolvedValue(
        makePlan({
          date: DATE_KEY,
          sessions: [makeSession({ taskId: 'solo', date: DATE_KEY, startMinutes: 0, endMinutes: 30 })],
        })
      );
      const applyDayPlan = jest.fn().mockResolvedValue('applied');
      const saveSessions = jest.fn().mockResolvedValue(undefined);
      const reload = jest.fn().mockResolvedValue({ tasks: [task], sessions: [] });

      await runPlacementWithRollover({
        targetDate: new Date(`${DATE_KEY}T00:00:00`),
        taskIds: ['solo'],
        tasks: [task],
        sessions: [],
        isToday: true,
        generateDayPlan,
        applyDayPlan,
        reload,
        saveSessions,
      });

      expect(saveSessions).not.toHaveBeenCalled();
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
