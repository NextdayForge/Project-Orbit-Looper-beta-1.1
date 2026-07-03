import {
  buildRolloverNotice,
  findLowerPriorityTaskIdsToBump,
  runPlacementWithRollover,
} from '../presentation/calendar/placementRollover';
import { DayPlan } from '../types/dayPlan';
import { Session } from '../types/session';
import { makeCapacity, makeSession, makeTask } from './fixtures';

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

    const bumped = findLowerPriorityTaskIdsToBump('2026-06-28', [session], [low, high], 2);
    expect(bumped).toEqual(['low']);
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
});
