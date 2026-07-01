import { buildDayPlanSessionBatch } from '../hooks/useScheduleActions';
import { shiftIncompleteSessionsFromNow } from '../intelligence/planner/shiftFromNow';
import { DayPlan } from '../types/dayPlan';
import { makeSession } from './fixtures';

const DATE = '2026-06-28';

describe('buildDayPlanSessionBatch', () => {
  it('persists rescheduled history from shift-from-now plans', () => {
    const pending = makeSession({
      id: 'old-session',
      taskId: 'task-a',
      startMinutes: 9 * 60,
      endMinutes: 10 * 60,
    });

    const { sessions: planSessions } = shiftIncompleteSessionsFromNow(
      DATE,
      [pending],
      14 * 60,
      5
    );

    const plan: DayPlan = {
      date: DATE,
      dayType: 'NORMAL',
      capacity: {
        availableMinutes: 240,
        targetFocusMinutes: 120,
        targetSessionCount: 1,
        bufferMinutes: 0,
        breakMinutes: 0,
        reasonTags: [],
      },
      sessions: planSessions,
      calendarBlocks: [],
      reasonTags: [],
      generatedAt: new Date().toISOString(),
    };

    const batch = buildDayPlanSessionBatch(plan, [], '2026-06-28T05:00:00.000Z');
    const byId = new Map(batch.map((session) => [session.id, session]));

    expect(byId.get('old-session')?.status).toBe('rescheduled');
    expect(batch.filter((session) => session.status === 'planned')).toHaveLength(1);
    expect(batch.filter((session) => session.status === 'rescheduled')).toHaveLength(1);
  });

  it('does not duplicate sessions when plan already includes rescheduled rows', () => {
    const rescheduled = makeSession({ id: 's1', status: 'rescheduled' });
    const planned = makeSession({ id: 's2', status: 'planned' });
    const plan: DayPlan = {
      date: DATE,
      dayType: 'NORMAL',
      capacity: {
        availableMinutes: 0,
        targetFocusMinutes: 0,
        targetSessionCount: 0,
        bufferMinutes: 0,
        breakMinutes: 0,
        reasonTags: [],
      },
      sessions: [rescheduled, planned],
      calendarBlocks: [],
      reasonTags: [],
      generatedAt: new Date().toISOString(),
    };

    const batch = buildDayPlanSessionBatch(plan, [], '2026-06-28T05:00:00.000Z');
    expect(batch).toHaveLength(2);
    expect(batch.map((session) => session.id).sort()).toEqual(['s1', 's2']);
  });
});
