import {
  buildPastIncompleteRescheduleBatch,
  getIncompleteTaskIdsBeforeDate,
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
});
