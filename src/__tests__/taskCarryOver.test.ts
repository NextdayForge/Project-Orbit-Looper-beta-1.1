import {
  buildPastIncompleteRescheduleBatch,
  getIncompleteTaskIdsBeforeDate,
  selectRehomedCarryOverTaskIds,
} from '../intelligence/planner/taskCarryOver';
import { makeSession } from './fixtures';

const TODAY = '2026-06-28';

describe('taskCarryOver', () => {
  it('collects incomplete task ids from any past date', () => {
    const sessions = [
      makeSession({ taskId: 'a', date: '2026-06-27' }),
      makeSession({ taskId: 'b', date: '2026-06-26', status: 'completed', completed: true }),
      makeSession({ taskId: 'c', date: '2026-06-29' }),
    ];

    expect(getIncompleteTaskIdsBeforeDate(sessions, TODAY).sort()).toEqual(['a']);
  });

  it('reschedules past incomplete sessions for carried tasks', () => {
    const sessions = [
      makeSession({ id: 'past-1', taskId: 'carry', date: '2026-06-27' }),
      makeSession({ id: 'today-1', taskId: 'carry', date: TODAY }),
    ];
    const batch = buildPastIncompleteRescheduleBatch(
      sessions,
      TODAY,
      ['carry'],
      '2026-06-28T09:00:00.000Z'
    );

    expect(batch).toHaveLength(1);
    expect(batch[0].id).toBe('past-1');
    expect(batch[0].status).toBe('rescheduled');
    expect(batch[0].rescheduledAt).toBe('2026-06-28T09:00:00.000Z');
  });

  describe('selectRehomedCarryOverTaskIds', () => {
    const carryOver = ['placedToday', 'rolledTomorrow', 'stuckPast'];

    it('treats a task rolled to a FUTURE day as re-homed (so its past session gets cleared)', () => {
      const sessions = [
        // placed today
        makeSession({ taskId: 'placedToday', date: TODAY }),
        makeSession({ taskId: 'placedToday', date: '2026-06-27' }),
        // rolled to tomorrow — previously left its past session lingering
        makeSession({ taskId: 'rolledTomorrow', date: '2026-06-29' }),
        makeSession({ taskId: 'rolledTomorrow', date: '2026-06-26' }),
        // only has a past session, no forward home → NOT re-homed, don't drop it
        makeSession({ taskId: 'stuckPast', date: '2026-06-25' }),
      ];

      expect(selectRehomedCarryOverTaskIds(sessions, TODAY, carryOver).sort()).toEqual([
        'placedToday',
        'rolledTomorrow',
      ]);
    });

    it('ignores non-carry-over tasks and non-mutable forward sessions', () => {
      const sessions = [
        makeSession({ taskId: 'other', date: '2026-06-29' }),
        makeSession({ taskId: 'placedToday', date: TODAY, status: 'rescheduled' }),
        makeSession({ taskId: 'rolledTomorrow', date: '2026-06-29', status: 'completed', completed: true }),
      ];

      expect(selectRehomedCarryOverTaskIds(sessions, TODAY, carryOver)).toEqual([]);
    });
  });
});
