import { buildRolloverNotice, findLowerPriorityTaskIdsToBump } from '../presentation/calendar/placementRollover';
import { makeSession, makeTask } from './fixtures';

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
});
