import {
  enforceSequentialFromNow,
  shiftIncompleteSessionsFromNow,
} from '../intelligence/planner/shiftFromNow';
import { makeSession } from './fixtures';

const DATE = '2026-06-28';

describe('enforceSequentialFromNow', () => {
  it('lays sessions out sequentially starting exactly at nowMinutes', () => {
    const sessions = [
      makeSession({ startMinutes: 7 * 60, endMinutes: 7 * 60 + 45 }),
      makeSession({ startMinutes: 9 * 60, endMinutes: 9 * 60 + 30 }),
    ];

    const result = enforceSequentialFromNow(sessions, 600, 5); // 10:00, 5min gap

    expect(result[0].startMinutes).toBe(600);
    expect(result[0].endMinutes).toBe(645);
    expect(result[1].startMinutes).toBe(650); // 645 + 5
    expect(result[1].endMinutes).toBe(680);
  });

  it('preserves input order rather than re-sorting by start time', () => {
    const sessions = [
      makeSession({ taskId: 'high', startMinutes: 15 * 60, endMinutes: 15 * 60 + 30 }),
      makeSession({ taskId: 'low', startMinutes: 8 * 60, endMinutes: 8 * 60 + 30 }),
    ];

    const result = enforceSequentialFromNow(sessions, 600, 0);

    expect(result[0].taskId).toBe('high');
    expect(result[1].taskId).toBe('low');
    expect(result[0].startMinutes).toBe(600);
  });

  it('does not place the first session at 07:00 (regression: force reschedule)', () => {
    const sessions = [makeSession({ startMinutes: 7 * 60, endMinutes: 7 * 60 + 60 })];
    const result = enforceSequentialFromNow(sessions, 13 * 60, 5);
    expect(result[0].startMinutes).toBe(13 * 60);
  });
});

describe('shiftIncompleteSessionsFromNow', () => {
  it('keeps completed sessions fixed and shifts only incomplete ones', () => {
    const completed = makeSession({
      taskId: 'done',
      startMinutes: 8 * 60,
      endMinutes: 9 * 60,
      status: 'completed',
      completed: true,
    });
    const pending = makeSession({
      taskId: 'pending',
      startMinutes: 9 * 60,
      endMinutes: 10 * 60,
    });

    const { sessions, replanTaskIds } = shiftIncompleteSessionsFromNow(
      DATE,
      [completed, pending],
      14 * 60,
      5
    );

    const movedDone = sessions.find((s) => s.taskId === 'done');
    const movedPending = sessions.find(
      (s) => s.taskId === 'pending' && s.status === 'planned'
    );
    const rescheduledPending = sessions.find(
      (s) => s.taskId === 'pending' && s.status === 'rescheduled'
    );

    expect(movedDone?.startMinutes).toBe(8 * 60); // unchanged
    expect(movedPending?.startMinutes).toBe(14 * 60); // shifted to now
    expect(rescheduledPending).toBeDefined();
    expect(replanTaskIds).toEqual(['pending']);
  });

  it('ignores rescheduled sessions', () => {
    const rescheduled = makeSession({ status: 'rescheduled' });
    const { replanTaskIds } = shiftIncompleteSessionsFromNow(DATE, [rescheduled], 600, 5);
    expect(replanTaskIds).toEqual([]);
  });
});
